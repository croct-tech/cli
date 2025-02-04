import {Installation, Sdk, SdkError} from '@/application/project/sdk/sdk';
import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {TargetSdk, WorkspaceApi} from '@/application/api/workspace';
import {JsonArrayNode, JsonObjectNode, JsonParser} from '@/infrastructure/json';
import {formatName} from '@/application/project/utils/formatName';
import {ExampleFile} from '@/application/project/example/example';
import {CodeFormatter} from '@/application/project/code/formatter/formatter';
import {Version} from '@/application/model/version';
import {FileSystem} from '@/application/fs/fileSystem';
import {Slot} from '@/application/model/slot';
import {LocalizedContent} from '@/application/model/experience';
import {HelpfulError} from '@/application/error';
import {Dependency, PackageManager} from '@/application/project/packageManager/packageManager';
import {WorkingDirectory} from '@/application/fs/workingDirectory';
import {TsConfigLoader} from '@/application/project/import/tsConfigLoader';

export type InstallationPlan = {
    tasks: Task[],
    configuration: ProjectConfiguration,
};

export type Configuration = {
    workspaceApi: WorkspaceApi,
    projectDirectory: WorkingDirectory,
    packageManager: PackageManager,
    formatter: CodeFormatter,
    fileSystem: FileSystem,
    tsConfigLoader: TsConfigLoader,
};

type VersionedContent = {
    slot: string,
    version: number,
    list: LocalizedContent[],
};

export abstract class JavaScriptSdk implements Sdk {
    protected static readonly CONTENT_PACKAGE = '@croct/content';

    protected readonly projectDirectory: WorkingDirectory;

    protected readonly packageManager: PackageManager;

    protected readonly workspaceApi: WorkspaceApi;

    protected readonly formatter: CodeFormatter;

    protected readonly fileSystem: FileSystem;

    private readonly importConfigLoader: TsConfigLoader;

    public constructor(configuration: Configuration) {
        this.projectDirectory = configuration.projectDirectory;
        this.packageManager = configuration.packageManager;
        this.workspaceApi = configuration.workspaceApi;
        this.formatter = configuration.formatter;
        this.fileSystem = configuration.fileSystem;
        this.importConfigLoader = configuration.tsConfigLoader;
    }

    protected abstract getPackage(): string;

    public async generateSlotExample(slot: Slot, installation: Installation): Promise<void> {
        const rootPath = this.projectDirectory.get();
        const files: string[] = [];

        for (const file of await this.generateSlotExampleFiles(slot, installation)) {
            const directory = this.fileSystem.joinPaths(rootPath, this.fileSystem.getDirectoryName(file.name));

            await this.fileSystem
                .createDirectory(directory, {recursive: true})
                .catch(() => null);

            const filePath = this.fileSystem.joinPaths(rootPath, file.name);

            await this.fileSystem.writeTextFile(filePath, file.code, {overwrite: true});

            files.push(filePath);
        }

        await this.formatter.format(files);
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
                    await this.packageManager.addDependencies(['croct'], true);
                    await this.packageManager.addDependencies([this.getPackage(), JavaScriptSdk.CONTENT_PACKAGE]);

                    notifier.confirm('Dependencies installed');
                } catch (error) {
                    notifier.alert('Failed to install dependencies', HelpfulError.formatMessage(error));
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
                        notifier.alert('Failed to download content', HelpfulError.formatMessage(error));
                    }
                },
            });
        }

        if (await this.isTypeScriptProject()) {
            tasks.push({
                title: 'Generate types',
                task: async notifier => {
                    try {
                        await this.updateTypes(resolvedInstallation, notifier);
                    } catch (error) {
                        notifier.alert('Failed to generate types', HelpfulError.formatMessage(error));
                    }

                    try {
                        await this.registerTypeFile(Object.values(resolvedInstallation.configuration.paths), notifier);
                    } catch (error) {
                        notifier.alert('Failed to register type file', HelpfulError.formatMessage(error));
                    }
                },
            });
        }

        tasks.push({
            title: 'Register script',
            task: async notifier => {
                try {
                    await this.packageManager.addScript('postinstall', 'croct install --no-interaction');

                    notifier.confirm('Script registered');
                } catch (error) {
                    notifier.alert('Failed to register script', HelpfulError.formatMessage(error));
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
                output.log('Installation in progress');
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

        const path = await this.locateFile(
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

        if (await this.isTypeScriptProject()) {
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

                await this.fileSystem.writeTextFile(
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
                    await this.fileSystem.writeTextFile(
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

        await this.fileSystem.writeTextFile(filePath, module, {overwrite: true});

        indicator.confirm('Types updated');
    }

    private async registerTypeFile(sourcePaths: string[], notifier: TaskNotifier): Promise<void> {
        const [configPath, packageInfo] = await Promise.all([
            this.getTypeScriptConfigPath(sourcePaths),
            this.mountContentPackageFolder(),
        ]);

        if (configPath === null) {
            throw new SdkError('TypeScript configuration not found');
        }

        const projectDirectory = this.projectDirectory.get();

        if (!this.fileSystem.isSubPath(projectDirectory, configPath)) {
            const relativePath = this.fileSystem.getRelativePath(projectDirectory, configPath);

            throw new SdkError(`TypeScript configuration is outside the project directory: \`${relativePath}\``);
        }

        if (packageInfo === null) {
            throw new SdkError(`Package ${JavaScriptSdk.CONTENT_PACKAGE} is not installed`);
        }

        const typeFile = this.fileSystem
            .getRelativePath(
                this.fileSystem.getDirectoryName(configPath),
                this.getTypeFile(packageInfo.directory),
            )
            .replace(/\\/g, '/');

        const config = JsonParser.parse(await this.fileSystem.readTextFile(configPath), JsonObjectNode);

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

        await this.fileSystem.writeTextFile(configPath, config.toString(), {overwrite: true});

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

    private async mountContentPackageFolder(): Promise<Dependency | null> {
        const packageInfo = await this.packageManager.getDependency(JavaScriptSdk.CONTENT_PACKAGE);

        if (packageInfo === null) {
            return null;
        }

        if (await this.fileSystem.isSymbolicLink(packageInfo.directory)) {
            // Package managers like PNPM create symlinks to the global cache.
            // Because the content is project-specific, create a local copy of the package
            // to avoid conflicts with other projects.
            const realPath = await this.fileSystem.getRealPath(packageInfo.directory);

            await this.fileSystem.delete(packageInfo.directory);
            await this.fileSystem.copy(realPath, packageInfo.directory, {recursive: true});
        }

        return packageInfo;
    }

    protected async locateFile(...fileNames: string[]): Promise<string | null> {
        const directory = this.projectDirectory.get();

        for (const filename of fileNames) {
            if (this.fileSystem.isAbsolutePath(filename)) {
                throw new SdkError('The file path must be relative');
            }

            const fullPath = this.fileSystem.joinPaths(directory, filename);

            if (await this.fileSystem.exists(fullPath)) {
                return filename;
            }
        }

        return null;
    }

    public async readFile(...fileNames: string[]): Promise<string | null> {
        const filePath = await this.locateFile(...fileNames);

        if (filePath === null) {
            return null;
        }

        return this.fileSystem.readTextFile(
            this.fileSystem.joinPaths(this.projectDirectory.get(), filePath),
        );
    }

    private getTypeFile(path: string): string {
        return this.fileSystem.joinPaths(path, 'types.d.ts');
    }

    protected isTypeScriptProject(): Promise<boolean> {
        return this.packageManager.hasDependency('typescript');
    }

    private async getTypeScriptConfigPath(sourcePaths: string[] = []): Promise<string | null> {
        const workingDirectory = this.projectDirectory.get();
        const config = await this.importConfigLoader.load(workingDirectory, {
            fileNames: ['tsconfig.json'],
            sourcePaths: sourcePaths.length === 0
                ? [workingDirectory]
                : sourcePaths,
        });

        if (config === null) {
            return null;
        }

        return config.matchedConfigPath;
    }
}
