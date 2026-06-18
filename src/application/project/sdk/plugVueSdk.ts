import type {Installation, InstallationPlan} from '@/application/project/sdk/sdk';
import {SdkError} from '@/application/project/sdk/sdk';
import type {Configuration as JavaScriptSdkConfiguration} from '@/application/project/sdk/javasScriptSdk';
import {JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import type {Codemod} from '@/application/project/code/transformation/codemod';
import type {Task, TaskNotifier} from '@/application/cli/io/output';
import type {VuePluginOptions} from '@/application/project/code/transformation/javascript/vuePluginCodemod';
import {EnvFile} from '@/application/project/code/envFile';
import type {ExampleFile} from '@/application/project/code/generation/example';
import {PlugVueExampleGenerator} from '@/application/project/code/generation/slot/plugVueExampleGenerator';
import type {Slot} from '@/application/model/slot';
import {ErrorReason, HelpfulError} from '@/application/error';
import type {ImportResolver} from '@/application/project/import/importResolver';
import type {AttributeType} from '@/application/project/code/transformation/javascript/utils/createObjectProps';

type CodemodConfiguration = {
    plugin: Codemod<string, VuePluginOptions>,
};

type Bundler = {
    package: string,
    prefix: string,
};

export type Configuration = JavaScriptSdkConfiguration & {
    codemod: CodemodConfiguration,
    bundlers: Bundler[],
    importResolver: ImportResolver,
};

type VueProjectInfo = {
    typescript: boolean,
    sourceDirectory: string,
    plugin: {
        file: string | null,
    },
    env?: {
        property: string,
        developmentFile: EnvFile,
        productionFile: EnvFile,
    },
};

type VueInstallation = Installation & {
    project: VueProjectInfo,
    notifier: TaskNotifier,
};

type PublicAppIds = {
    development: string,
    production?: string,
};

export class PlugVueSdk extends JavaScriptSdk {
    private readonly codemod: CodemodConfiguration;

    private readonly bundlers: Bundler[];

    private readonly importResolver: ImportResolver;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.codemod = configuration.codemod;
        this.bundlers = configuration.bundlers;
        this.importResolver = configuration.importResolver;
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const isTypeScript = await this.isTypeScriptProject();

        const paths = await this.getPaths(installation.configuration);
        const slotPath = this.fileSystem.joinPaths(paths.components, '%slug%.vue');
        const pagePath = this.fileSystem.joinPaths(paths.examples, '%slug%-example.vue');

        const generator = new PlugVueExampleGenerator({
            typescript: isTypeScript,
            contentVariable: 'content',
            slotImportPath: await this.importResolver.getImportPath(slotPath, pagePath),
            slotFilePath: slotPath,
            slotComponentName: '%name%',
            pageFilePath: pagePath,
        });

        const example = generator.generate({
            id: slot.slug,
            version: slot.version.major,
            definition: slot.resolvedDefinition,
        });

        return example.files;
    }

    protected async getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        const {configuration} = installation;
        const projectInfo = await this.getProjectInfo();

        return {
            dependencies: ['@croct/plug-vue'],
            tasks: this.getInstallationTasks({
                ...installation,
                project: projectInfo,
            }),
            configuration: configuration,
        };
    }

    private async getProjectInfo(): Promise<VueProjectInfo> {
        const sourceDirectory = 'src';
        const envProperty = await this.getEnvVarProperty();
        const projectDirectory = this.projectDirectory.get();

        return {
            typescript: await this.isTypeScriptProject(),
            sourceDirectory: sourceDirectory,
            plugin: {
                file: await this.locateFile(
                    ...['main', 'index'].flatMap(name => ['ts', 'js'].map(ext => `${name}.${ext}`))
                        .map(file => this.fileSystem.joinPaths(sourceDirectory, file)),
                ),
            },
            env: envProperty === null
                ? undefined
                : {
                    property: envProperty,
                    productionFile: new EnvFile(
                        this.fileSystem,
                        this.fileSystem.joinPaths(projectDirectory, '.env.production'),
                    ),
                    developmentFile: new EnvFile(
                        this.fileSystem,
                        this.fileSystem.joinPaths(projectDirectory, '.env.development'),
                    ),
                },
        };
    }

    private getInstallationTasks(installation: Omit<VueInstallation, 'notifier'>): Task[] {
        const tasks: Task[] = [];
        const projectEnv = installation.project.env;
        const {configuration} = installation;

        let publicIdsPromise: Promise<PublicAppIds> | null = null;

        const getPublicIds = (): Promise<PublicAppIds> => {
            if (publicIdsPromise === null) {
                publicIdsPromise = Promise.all([
                    this.workspaceApi.getApplication({
                        organizationSlug: configuration.organization,
                        workspaceSlug: configuration.workspace,
                        applicationSlug: configuration.applications.development,
                    }),
                    configuration.applications.production === undefined
                        ? null
                        : this.workspaceApi.getApplication({
                            organizationSlug: configuration.organization,
                            workspaceSlug: configuration.workspace,
                            applicationSlug: configuration.applications.production,
                        }),
                ]).then(([development, production]) => {
                    if (development === null) {
                        return Promise.reject(
                            new SdkError(
                                `Development application ${configuration.applications.development} not found`,
                                {reason: ErrorReason.NOT_FOUND},
                            ),
                        );
                    }

                    return {
                        development: development.publicId,
                        production: production?.publicId,
                    };
                });
            }

            return publicIdsPromise;
        };

        if (projectEnv !== undefined) {
            const {developmentFile, productionFile, property} = projectEnv;
            const variable = property.split('.').pop()!;

            tasks.push({
                title: 'Setup environment variables',
                task: async notifier => {
                    notifier.update('Setting up environment variables');

                    try {
                        const publicIds = await getPublicIds();

                        await Promise.all([
                            developmentFile.setVariable(variable, publicIds.development),
                            publicIds.production === undefined
                                ? Promise.resolve()
                                : productionFile.setVariable(variable, publicIds.production),
                        ]);

                        notifier.confirm('Environment variables updated');
                    } catch (error) {
                        notifier.alert('Failed to update environment variables', HelpfulError.formatMessage(error));
                    }
                },
            });
        }

        tasks.push({
            title: 'Register plugin',
            task: async notifier => {
                notifier.update('Registering plugin');

                const pluginFile = installation.project.plugin.file;

                try {
                    if (pluginFile === null) {
                        notifier.alert('No Vue entry file found');
                    } else {
                        await this.installPlugin(pluginFile, {
                            args: {
                                appId: PlugVueSdk.getAppIdProperty(await getPublicIds(), projectEnv?.property),
                            },
                        });

                        notifier.confirm('Plugin registered');
                    }
                } catch {
                    notifier.alert(
                        'Failed to register plugin',
                        'Register the Croct plugin in your Vue entry: '
                        + 'app.use(createCroct({appId: \'<your-app-id>\'})) before app.mount().',
                    );
                }
            },
        });

        return tasks;
    }

    private async installPlugin(file: string, options: VuePluginOptions): Promise<void> {
        const codemod = this.codemod.plugin;

        await codemod.apply(this.fileSystem.joinPaths(this.projectDirectory.get(), file), options);
    }

    private async getEnvVarProperty(): Promise<string | null> {
        for (const bundler of this.bundlers) {
            if (await this.packageManager.hasDirectDependency(bundler.package)) {
                return `${bundler.prefix}CROCT_APP_ID`;
            }
        }

        return null;
    }

    private static getAppIdProperty(applicationIds: PublicAppIds, env?: string): AttributeType {
        if (env !== undefined) {
            return {
                type: 'reference',
                path: env.split('.'),
            };
        }

        if (applicationIds.production === undefined) {
            return {
                type: 'literal',
                value: applicationIds.development,
            };
        }

        return {
            type: 'ternary',
            condition: {
                operator: '===',
                left: {
                    type: 'reference',
                    path: ['import', 'meta', 'env', 'MODE'],
                },
                right: {
                    type: 'literal',
                    value: 'production',
                },
            },
            consequent: {
                type: 'literal',
                value: applicationIds.production,
            },
            alternate: {
                type: 'literal',
                value: applicationIds.development,
            },
        };
    }
}
