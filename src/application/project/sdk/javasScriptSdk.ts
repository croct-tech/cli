import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {PackageInfo} from '@/application/project/manager/projectManager';
import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {TargetSdk, WorkspaceApi} from '@/application/api/workspace';
import {formatMessage} from '@/application/error';
import {JsonArrayNode, JsonObjectNode, JsonParser} from '@/infrastructure/json';
import {formatName} from '@/application/project/utils/formatName';
import {ExampleFile} from '@/application/project/example/example';
import {Linter} from '@/application/project/linter';
import {Version} from '@/application/project/version';
import {FileSystem} from '@/application/fileSystem/fileSystem';
import {JavaScriptProjectManager} from '@/application/project/manager/javaScriptProjectManager';
import {ApplicationPlatform} from '@/application/model/application';
import {Slot} from '@/application/model/slot';
import {LocalizedContent} from '@/application/model/experience';

export type InstallationPlan = {
    tasks: Task[],
    configuration: ProjectConfiguration,
};

export type Configuration = {
    projectManager: JavaScriptProjectManager,
    workspaceApi: WorkspaceApi,
    linter: Linter,
    fileSystem: FileSystem,
};

type VersionedContent = {
    slot: string,
    version: number,
    list: LocalizedContent[],
};

export abstract class JavaScriptSdk implements Sdk {
    protected static readonly CONTENT_PACKAGE = '@croct/content';

    protected readonly projectManager: JavaScriptProjectManager;

    protected readonly workspaceApi: WorkspaceApi;

    protected readonly linter: Linter;

    protected readonly fileSystem: FileSystem;

    public constructor({projectManager, linter, workspaceApi, fileSystem}: Configuration) {
        this.projectManager = projectManager;
        this.workspaceApi = workspaceApi;
        this.linter = linter;
        this.fileSystem = fileSystem;
    }

    public abstract getPackage(): string;

    public abstract getPlatform(): ApplicationPlatform;

    public async generateSlotExample(slot: Slot, installation: Installation): Promise<void> {
        const rootPath = this.projectManager.getRootPath();
        const files: string[] = [];

        for (const file of await this.generateSlotExampleFiles(slot, installation)) {
            const directory = this.fileSystem.joinPaths(rootPath, this.fileSystem.getDirectoryName(file.name));

            await this.fileSystem
                .createDirectory(directory, {recursive: true})
                .catch(() => null);

            const filePath = this.fileSystem.joinPaths(rootPath, file.name);

            await this.fileSystem.writeFile(filePath, file.code, {overwrite: true});

            files.push(filePath);
        }

        await this.linter.fix(files);
    }

    protected abstract generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]>;

    public async install(installation: Installation): Promise<ProjectConfiguration> {
        const {input, output} = installation;

        const plan = await this.getInstallationPlan(installation);

        const configuration: ProjectConfiguration = {
            ...plan.configuration,
            paths: {
                components: await this.resolvePath(
                    ['components', 'Components', 'component', 'Component'],
                    plan.configuration.paths.components,
                ),
                examples: await this.resolvePath(
                    ['examples', 'Examples'],
                    plan.configuration.paths.examples,
                ),
            },
        };

        const resolvedInstallation: Installation = {
            ...installation,
            configuration: {
                ...installation.configuration,
                ...configuration,
                applications: installation.configuration.applications,
            },
        };

        const tasks: Task[] = [];

        tasks.push({
            title: 'Install dependencies',
            task: async notifier => {
                notifier.update('Installing dependencies');

                try {
                    await this.projectManager.installPackage('croct', {dev: true});
                    await this.projectManager.installPackage([this.getPackage(), JavaScriptSdk.CONTENT_PACKAGE]);

                    notifier.confirm('Dependencies installed');
                } catch (error) {
                    notifier.alert('Failed to install dependencies', formatMessage(error));
                }
            },
        });

        tasks.push(...plan.tasks);

        if (Object.keys(configuration.slots).length > 0) {
            tasks.push({
                title: 'Download content',
                task: async notifier => {
                    try {
                        await this.updateContent(resolvedInstallation, notifier);
                    } catch (error) {
                        notifier.alert('Failed to download content', formatMessage(error));
                    }
                },
            });
        }

        if (await this.projectManager.isTypeScriptProject()) {
            tasks.push({
                title: 'Generate types',
                task: async notifier => {
                    try {
                        await this.updateTypes(resolvedInstallation, notifier);
                    } catch (error) {
                        notifier.alert('Failed to generate types', formatMessage(error));
                    }

                    try {
                        await this.registerTypeFile(Object.values(resolvedInstallation.configuration.paths), notifier);
                    } catch (error) {
                        notifier.alert('Failed to register type file', formatMessage(error));
                    }
                },
            });
        }

        tasks.push({
            title: 'Register script',
            task: async notifier => {
                try {
                    await this.registerScript(notifier);
                } catch (error) {
                    notifier.alert('Failed to register script', formatMessage(error));
                }
            },
        });

        if (tasks.length > 0) {
            if (input !== undefined) {
                output.break();
                output.inform('**Installation plan**');

                for (const {title} of tasks) {
                    output.log(` - ${title}`);
                }

                output.break();

                if (!await input.confirm({message: 'Proceed?', default: true})) {
                    return output.exit();
                }
            } else {
                output.log('Installation in progress...');
            }

            await output.monitor({tasks: tasks});
        }

        return configuration;
    }

    private async resolvePath(directories: string[], currentPath: string): Promise<string> {
        if (currentPath !== '') {
            return currentPath;
        }

        const parentDirs = ['lib', 'src'];

        const path = await this.projectManager.locateFile(
            ...parentDirs.flatMap(dir => directories.map(directory => this.fileSystem.joinPaths(dir, directory))),
            ...directories,
            ...parentDirs,
        );

        if (path === null) {
            return directories[0];
        }

        if (parentDirs.includes(path)) {
            return this.fileSystem.joinPaths(path, directories[0]);
        }

        return path;
    }

    protected abstract getInstallationPlan(installation: Installation): Promise<InstallationPlan>;

    public async update(installation: Installation): Promise<void> {
        await this.updateContent(installation);

        if (await this.projectManager.isTypeScriptProject()) {
            await this.updateTypes(installation);
        }
    }

    public async updateContent(installation: Installation, notifier?: TaskNotifier): Promise<void> {
        const {output} = installation;
        const indicator = notifier ?? output.notify('Updating content');

        const configuration = await this.resolveVersions(installation.configuration);
        const slots = Object.entries(configuration.slots);

        if (slots.length === 0) {
            indicator.confirm('No content to update');

            return;
        }

        const packageInfo = await this.mountContentPackageFolder();

        if (packageInfo === null) {
            indicator.alert(`The package ${JavaScriptSdk.CONTENT_PACKAGE} is not installed`);

            return;
        }

        const contentList = await Promise.all(
            slots.flatMap(([slot, versionSpecifier]) => {
                const constraint = Version.parse(versionSpecifier);
                const versions = constraint.getVersions();

                return versions.map(
                    version => this.workspaceApi
                        .getSlotStaticContent(
                            {
                                organizationSlug: configuration.organization,
                                workspaceSlug: configuration.workspace,
                                slotSlug: slot,
                            },
                            version,
                        )
                        .then(
                            (content): VersionedContent => ({
                                slot: slot,
                                version: version,
                                list: content,
                            }),
                        ),
                );
            }),
        );

        const directoryPath = this.fileSystem.joinPaths(packageInfo.directory, 'slot');

        await this.fileSystem.delete(directoryPath, {recursive: true});
        await this.fileSystem.createDirectory(directoryPath);

        const indexes: Record<string, string[]> = {};

        for (const versionedContent of contentList) {
            for (const {locale, content} of versionedContent.list) {
                const baseName = `${versionedContent.slot}@${versionedContent.version}`;

                indexes[locale] = [...indexes[locale] ?? [], baseName];

                const localeDirectory = this.fileSystem.joinPaths(directoryPath, locale);

                if (!await this.fileSystem.isDirectory(localeDirectory)) {
                    await this.fileSystem.createDirectory(
                        this.fileSystem.joinPaths(directoryPath, locale),
                        {recursive: true},
                    );
                }

                await this.fileSystem.writeFile(
                    this.fileSystem.joinPaths(directoryPath, locale, `${baseName}.json`),
                    JSON.stringify(content, null, 2),
                    {overwrite: true},
                );
            }
        }

        for (const [locale, files] of Object.entries(indexes)) {
            const paths = [`./${locale}`];

            if (locale === configuration.defaultLocale) {
                paths.push('./');
            }

            for (const path of paths) {
                const importFile = path === './' ? `./${locale}/` : './';
                const moduleCode = files.map(file => {
                    const alias = formatName(file.replace('@', ' V'));

                    return `export {default as ${alias}} from '${importFile}${file}.json' with {type: 'json'};`;
                }).join('\n');

                for (const extension of ['.js', '.d.ts']) {
                    await this.fileSystem.writeFile(
                        this.fileSystem.joinPaths(directoryPath, path, `index${extension}`),
                        moduleCode,
                        {overwrite: true},
                    );
                }
            }
        }

        indicator.confirm('Content updated');
    }

    public async updateTypes(installation: Installation, notifier?: TaskNotifier): Promise<void> {
        const {output} = installation;

        const indicator = notifier ?? output.notify('Updating types');

        const configuration = await this.resolveVersions(installation.configuration);
        const slots = Object.entries(configuration.slots);
        const components = Object.entries(configuration.components);

        const packageInfo = await this.mountContentPackageFolder();

        if (packageInfo === null) {
            indicator.alert(`The package ${JavaScriptSdk.CONTENT_PACKAGE} is not installed`);

            return;
        }

        const filePath = this.getTypeFile(packageInfo.directory);

        // Create the directory if it does not exist
        await this.fileSystem
            .createDirectory(this.fileSystem.getDirectoryName(filePath), {recursive: true})
            .catch(() => {
            });

        let module = 'export {};';

        if (slots.length > 0 || components.length > 0) {
            const types = await this.workspaceApi.generateTypes({
                workspaceId: configuration.workspaceId,
                target: TargetSdk.JAVASCRIPT,
                components: components.map(
                    ([component, version]) => ({
                        id: component,
                        version: version.toString(),
                    }),
                ),
                slots: slots.map(
                    ([slot, version]) => ({
                        id: slot,
                        version: version.toString(),
                    }),
                ),
            });

            module = `${types}\n${module}`;
        }

        await this.fileSystem.writeFile(filePath, module, {overwrite: true});

        indicator.confirm('Types updated');
    }

    private async registerScript(notifier: TaskNotifier): Promise<void> {
        const packageFile = this.projectManager.getProjectPackagePath();
        const content = await this.fileSystem.readFile(packageFile);

        const packageJson = JsonParser.parse(content, JsonObjectNode);

        let command = 'croct install';

        if (packageJson.has('scripts')) {
            const scripts = packageJson.get('scripts', JsonObjectNode);

            if (scripts.has('postinstall')) {
                const postInstall = scripts.get('postinstall');
                const value = postInstall.toJSON();

                if (typeof value === 'string' && value.includes('croct install --no-interaction')) {
                    return notifier.confirm('Script already registered');
                }

                command = `${value} && ${command}`;
            }

            scripts.set('postinstall', command);
        } else {
            packageJson.set('scripts', {
                postinstall: command,
            });
        }

        await this.fileSystem.writeFile(packageFile, packageJson.toString(), {overwrite: true});

        notifier.confirm('Script registered');
    }

    private async registerTypeFile(sourcePaths: string[], notifier: TaskNotifier): Promise<void> {
        const [configPath, packageInfo] = await Promise.all([
            this.projectManager.getTypeScriptConfigPath(sourcePaths),
            this.mountContentPackageFolder(),
        ]);

        if (configPath === null) {
            throw new Error('TypeScript configuration not found');
        }

        const projectDirectory = this.projectManager.getRootPath();
        const relativeConfigPath = this.fileSystem.getRelativePath(projectDirectory, configPath);

        if (
            relativeConfigPath.length === 0
            || relativeConfigPath.startsWith('..')
            || this.fileSystem.isAbsolutePath(relativeConfigPath)
        ) {
            const relativePath = this.fileSystem.getRelativePath(projectDirectory, configPath);

            throw new Error(`TypeScript configuration is outside the project directory: \`${relativePath}\``);
        }

        if (packageInfo === null) {
            throw new Error(`Package ${JavaScriptSdk.CONTENT_PACKAGE} is not installed`);
        }

        const typeFile = this.fileSystem
            .getRelativePath(
                this.fileSystem.getDirectoryName(configPath),
                this.getTypeFile(packageInfo.directory),
            )
            .replace(/\\/g, '/');

        const config = JsonParser.parse(await this.fileSystem.readFile(configPath), JsonObjectNode);

        if (config.has('files')) {
            const files = config.get('files', JsonArrayNode);
            const currentFiles = files.toJSON();

            if (currentFiles.includes(typeFile)) {
                return notifier.confirm('Type file already registered');
            }

            files.push(typeFile);
        } else {
            config.set('files', [typeFile]);
        }

        await this.fileSystem.writeFile(configPath, config.toString(), {overwrite: true});

        notifier.confirm('Type file registered');
    }

    private async resolveVersions(configuration: ResolvedConfiguration): Promise<ResolvedConfiguration> {
        const listedComponents = Object.keys(configuration.components);
        const listedSlots = Object.keys(configuration.slots);

        if (listedComponents.length === 0 && listedSlots.length === 0) {
            return configuration;
        }

        const [slots, components] = await Promise.all([
            this.workspaceApi.getSlots({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
            }),
            this.workspaceApi.getComponents({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
            }),
        ]);

        return {
            ...configuration,
            components: Object.fromEntries(
                Object.entries(configuration.components).flatMap<[string, string]>(([slug, version]) => {
                    const versions = Version.parse(version)
                        .getVersions()
                        .filter(
                            major => components.some(
                                component => component.slug === slug
                                    && major <= component.version.major,
                            ),
                        );

                    if (versions.length === 0) {
                        return [];
                    }

                    return [[slug, Version.either(...versions).toString()]];
                }),
            ),
            slots: Object.fromEntries(
                Object.entries(configuration.slots).flatMap<[string, string]>(([slug, version]) => {
                    const versions = Version.parse(version)
                        .getVersions()
                        .filter(
                            major => slots.some(
                                slot => slot.slug === slug
                                    && major <= slot.version.major,
                            ),
                        );

                    if (versions.length === 0) {
                        return [];
                    }

                    return [[slug, Version.either(...versions).toString()]];
                }),
            ),
        };
    }

    private async mountContentPackageFolder(): Promise<PackageInfo | null> {
        const packageInfo = await this.projectManager.getPackageInfo(JavaScriptSdk.CONTENT_PACKAGE);

        if (packageInfo === null) {
            return null;
        }

        if (await this.fileSystem.isSymbolicLink(packageInfo.directory)) {
            // Package managers like PNPM create symlinks to the global cache.
            // Because the content is project-specific, create a local copy of the package
            // to avoid conflicts with other projects.
            const realPath = await this.fileSystem.getRealPath(packageInfo.directory);

            await this.fileSystem.delete(packageInfo.directory);
            await this.fileSystem.copyDirectory(realPath, packageInfo.directory, {recursive: true});
        }

        return packageInfo;
    }

    private getTypeFile(path: string): string {
        return this.fileSystem.joinPaths(path, 'types.d.ts');
    }
}
