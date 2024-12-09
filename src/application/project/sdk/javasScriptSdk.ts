import {dirname, join, relative, resolve} from 'path';
import {
    mkdir,
    readFile,
    writeFile,
    lstat,
    realpath,
    unlink,
    cp,
} from 'fs/promises';
import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {JavaScriptProject, PackageInfo} from '@/application/project/project';
import {ApplicationPlatform, Slot} from '@/application/model/entities';
import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {LocalizedContent, TargetSdk, WorkspaceApi} from '@/application/api/workspace';
import {formatMessage} from '@/application/error';
import {JsonArrayNode, JsonObjectNode, JsonParser} from '@/infrastructure/json';
import {formatName} from '@/application/project/utils/formatName';
import {ExampleFile} from '@/application/project/example/example';
import {Linter} from '@/application/project/linter';
import {Version} from '@/application/project/version';

export type InstallationPlan = {
    tasks: Task[],
    configuration: ProjectConfiguration,
};

export type Configuration = {
    project: JavaScriptProject,
    workspaceApi: WorkspaceApi,
    linter: Linter,
};

type VersionedContent = {
    version: number,
    list: LocalizedContent[],
};

export abstract class JavaScriptSdk implements Sdk {
    protected static readonly CONTENT_PACKAGE = '@croct/content';

    protected readonly project: JavaScriptProject;

    protected readonly workspaceApi: WorkspaceApi;

    protected readonly linter: Linter;

    public constructor({project, linter, workspaceApi}: Configuration) {
        this.project = project;
        this.workspaceApi = workspaceApi;
        this.linter = linter;
    }

    public abstract getPackage(): string;

    public abstract getPlatform(): ApplicationPlatform;

    public async generateSlotExample(slot: Slot, installation: Installation): Promise<void> {
        const rootPath = this.project.getRootPath();
        const files: string[] = [];

        for (const file of await this.generateSlotExampleFiles(slot, installation)) {
            const directory = join(rootPath, dirname(file.name));

            await mkdir(directory, {recursive: true}).catch(() => null);

            const filePath = join(rootPath, file.name);

            await writeFile(filePath, file.code, {
                encoding: 'utf-8',
                flag: 'w',
            });

            files.push(filePath);
        }

        await this.linter.fix(files);
    }

    protected abstract generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]>;

    public async install(installation: Installation): Promise<ProjectConfiguration> {
        const {input, output, configuration} = installation;

        const plan = await this.getInstallationPlan(installation);
        const tasks: Task[] = [];

        tasks.push({
            title: 'Install dependencies',
            task: async notifier => {
                notifier.update('Installing dependencies');

                try {
                    await this.project.installPackage('croct', {dev: true});
                    await this.project.installPackage([this.getPackage(), JavaScriptSdk.CONTENT_PACKAGE]);

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
                        await this.updateContent(installation, notifier);
                    } catch (error) {
                        notifier.alert('Failed to download content', formatMessage(error));
                    }
                },
            });
        }

        if (await this.project.isTypeScriptProject()) {
            tasks.push({
                title: 'Generate types',
                task: async notifier => {
                    try {
                        await this.updateTypes(installation, notifier);
                        await this.registerTypeFile(notifier);
                    } catch (error) {
                        notifier.alert('Failed to generate types', formatMessage(error));
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

        return {
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
    }

    private async resolvePath(directories: string[], currentPath: string): Promise<string> {
        if (currentPath !== '') {
            return currentPath;
        }

        const parentDirs = ['lib', 'src'];

        const path = await this.project.locateFile(
            ...parentDirs.flatMap(dir => directories.map(directory => join(dir, directory))),
            ...directories,
            ...parentDirs,
        );

        if (path === null) {
            return directories[0];
        }

        if (parentDirs.includes(path)) {
            return join(path, directories[0]);
        }

        return path;
    }

    protected abstract getInstallationPlan(installation: Installation): Promise<InstallationPlan>;

    public async update(installation: Installation): Promise<void> {
        await this.updateContent(installation);

        if (await this.project.isTypeScriptProject()) {
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
                    (version): Promise<VersionedContent|null> => this.workspaceApi
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
                                version: version,
                                list: content,
                            }),
                        ),
                );
            }),
        );

        const directoryPath = join(packageInfo.path, 'slot');

        // Create the directory if it does not exist
        await mkdir(directoryPath).catch(() => {});

        const indexes: Record<string, string[]> = {};

        for (let index = 0; index < slots.length; index++) {
            const [slot] = slots[index];
            const versionedContent = contentList[index];

            if (versionedContent === null) {
                continue;
            }

            for (const {locale, content} of versionedContent.list) {
                const baseName = `${slot}@${versionedContent.version}`;

                indexes[locale] = [...indexes[locale] ?? [], baseName];

                await mkdir(join(directoryPath, locale), {recursive: true}).catch(() => {});

                await writeFile(join(directoryPath, `${locale}/${baseName}.json`), JSON.stringify(content, null, 2), {
                    encoding: 'utf-8',
                    flag: 'w',
                });
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
                    await writeFile(join(directoryPath, `${path}/index${extension}`), moduleCode, {
                        encoding: 'utf-8',
                        flag: 'w',
                    });
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

        const filePath = JavaScriptSdk.getTypeFile(packageInfo.path);

        // Create the directory if it does not exist
        await mkdir(dirname(filePath), {recursive: true}).catch(() => {});

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

        await writeFile(filePath, module, {
            encoding: 'utf-8',
            flag: 'w',
        });

        indicator.confirm('Types updated');
    }

    private async registerScript(notifier: TaskNotifier): Promise<void> {
        const packageFile = this.project.getProjectPackagePath();
        const content = await readFile(packageFile, {encoding: 'utf-8'});

        const packageJson = JsonParser.parse(content, JsonObjectNode);

        let command = 'croct install';

        if (packageJson.has('scripts')) {
            const scripts = packageJson.get('scripts', JsonObjectNode);

            if (scripts.has('postinstall')) {
                const postInstall = scripts.get('postinstall');
                const value = postInstall.toJSON();

                if (typeof value === 'string' && value.includes('croct install')) {
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

        await writeFile(packageFile, packageJson.toString(), {
            encoding: 'utf-8',
            flag: 'w',
        });

        notifier.confirm('Script registered');
    }

    private async registerTypeFile(notifier: TaskNotifier): Promise<void> {
        const [configPath, packageInfo] = await Promise.all([
            this.project.getTypeScriptConfigPath(),
            this.mountContentPackageFolder(),
        ]);

        if (configPath === null) {
            notifier.alert('TypeScript configuration not found');

            return;
        }

        if (packageInfo === null) {
            notifier.alert(`The package ${JavaScriptSdk.CONTENT_PACKAGE} is not installed`);

            return;
        }

        const typeFile = relative(this.project.getRootPath(), JavaScriptSdk.getTypeFile(packageInfo.path));
        const config = JsonParser.parse(await readFile(configPath, {encoding: 'utf-8'}), JsonObjectNode);

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

        await writeFile(configPath, config.toString(), {
            encoding: 'utf-8',
            flag: 'w',
        });

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

    private async mountContentPackageFolder(): Promise<PackageInfo|null> {
        const packageInfo = await this.project.getPackageInfo(JavaScriptSdk.CONTENT_PACKAGE);

        if (packageInfo === null) {
            return null;
        }

        const stats = await lstat(packageInfo.path);

        if (stats.isSymbolicLink()) {
            // Package managers like PNPM create symlinks to the global cache.
            // Because the content is project-specific, create a local copy of the package
            // to avoid conflicts with other projects.
            const realPath = await realpath(packageInfo.path);

            await unlink(packageInfo.path);

            const localFolder = resolve(packageInfo.path);

            await cp(realPath, localFolder, {recursive: true});
        }

        return packageInfo;
    }

    private static getTypeFile(path: string): string {
        return join(path, 'types.d.ts');
    }
}
