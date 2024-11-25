import {dirname, join, relative} from 'path';
import {mkdir, readFile, writeFile} from 'fs/promises';
import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {JavaScriptProject} from '@/application/project/project';
import {ApplicationPlatform, Slot} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/project/configuration';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {TargetSdk, WorkspaceApi} from '@/application/api/workspace';
import {formatMessage} from '@/application/error';
import {JsonParser, JsonArrayNode, JsonObjectNode} from '@/infrastructure/json';
import {formatName} from '@/application/project/utils/formatName';
import {ExampleFile} from '@/application/project/example/example';
import {Linter} from '@/application/project/linter';

export type InstallationPlan = {
    tasks: Task[],
    configuration: ProjectConfiguration,
};

export type Configuration = {
    project: JavaScriptProject,
    workspaceApi: WorkspaceApi,
    linter: Linter,
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
                title: 'Update content',
                task: async notifier => {
                    try {
                        await this.updateContent(installation, notifier);
                    } catch (error) {
                        notifier.alert('Failed to update content', formatMessage(error));
                    }
                },
            });
        }

        if (await this.project.isTypeScriptProject()) {
            tasks.push({
                title: 'Update types',
                task: async notifier => {
                    try {
                        await this.updateTypes(installation, notifier);
                    } catch (error) {
                        notifier.alert('Failed to update types', formatMessage(error));
                    }
                },
            });

            tasks.push({
                title: 'Register type file',
                task: async notifier => {
                    try {
                        await this.registerTypeFile(notifier);
                    } catch (error) {
                        notifier.alert('Failed to register type file', formatMessage(error));
                    }
                },
            });
        }

        tasks.push({
            title: 'Register post-install hook',
            task: async notifier => {
                try {
                    await this.registerNpmHookScript(notifier);
                } catch (error) {
                    notifier.alert('Failed to register NPM hook', formatMessage(error));
                }
            },
        });

        if (tasks.length > 0) {
            output.break();
            output.inform('**Installation plan**');

            for (const {title} of tasks) {
                output.log(` - ${title}`);
            }

            output.break();

            if (!await input.confirm({message: 'Proceed?', default: true})) {
                output.alert('Installation aborted');

                return output.exit();
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
        const {configuration, output} = installation;
        const slots = Object.entries(configuration.slots);

        if (slots.length === 0) {
            return;
        }

        const indicator = notifier ?? output.notify('Downloading content');
        const packageInfo = await this.project.getPackageInfo(JavaScriptSdk.CONTENT_PACKAGE);

        if (packageInfo === null) {
            indicator.alert(`The package ${JavaScriptSdk.CONTENT_PACKAGE} is not installed`);

            return;
        }

        const contentList = await Promise.all(slots.map(
            ([slot, version]) => this.workspaceApi.getSlotStaticContent(
                {
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    slotSlug: slot,
                },
                version.getMaxVersion(),
            ),
        ));

        const directoryPath = join(packageInfo.path, 'slot');

        // Create the directory if it does not exist
        await mkdir(directoryPath).catch(() => {});

        const indexes: Record<string, string[]> = {};

        for (let index = 0; index < slots.length; index++) {
            const [slot, version] = slots[index];

            for (const {locale, content} of contentList[index]) {
                const baseName = `${slot}@${version}`;

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

        indicator.confirm('Content downloaded');
    }

    public async updateTypes(installation: Installation, notifier?: TaskNotifier): Promise<void> {
        const {configuration, output} = installation;
        const slots = Object.entries(configuration.slots);
        const components = Object.entries(configuration.components);

        const indicator = notifier ?? output.notify('Generating types');

        const packageInfo = await this.project.getPackageInfo(JavaScriptSdk.CONTENT_PACKAGE);

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

        indicator.confirm('Types generated');
    }

    private async registerNpmHookScript(notifier: TaskNotifier): Promise<void> {
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
                    return notifier.confirm('Hook already registered');
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

        notifier.confirm('Hook script registered');
    }

    private async registerTypeFile(notifier: TaskNotifier): Promise<void> {
        const [configPath, packageInfo] = await Promise.all([
            this.project.getTypeScriptConfigPath(),
            this.project.getPackageInfo(JavaScriptSdk.CONTENT_PACKAGE),
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

    private static getTypeFile(path: string): string {
        return join(path, 'types.d.ts');
    }
}
