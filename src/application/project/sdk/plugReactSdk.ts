import {Installation} from '@/application/project/sdk/sdk';
import {
    InstallationPlan,
    JavaScriptSdk,
    Configuration as JavaScriptSdkConfiguration,
} from '@/application/project/sdk/javasScriptSdk';
import {Codemod} from '@/application/project/code/transformation/codemod';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {WrapperOptions} from '@/application/project/code/transformation/javascript/jsxWrapperCodemod';
import {EnvFile} from '@/application/project/code/envFile';
import {CodeLanguage, ExampleFile} from '@/application/project/code/generation/example';
import {PlugReactExampleGenerator} from '@/application/project/code/generation/slot/plugReactExampleGenerator';
import {ResolvedConfiguration} from '@/application/project/configuration/projectConfiguration';
import {Slot} from '@/application/model/slot';
import {HelpfulError} from '@/application/error';
import {ImportResolver} from '@/application/project/import/importResolver';
import {AttributeType} from '@/application/project/code/transformation/javascript/utils/createJsxProps';

type CodemodConfiguration = {
    provider: Codemod<string, WrapperOptions>,
};

type Bundlers = {
    package: string,
    prefix: string,
};

export type Configuration = JavaScriptSdkConfiguration & {
    codemod: CodemodConfiguration,
    bundlers: Bundlers[],
    importResolver: ImportResolver,
};

type ReactProjectInfo = {
    typescript: boolean,
    sourceDirectory: string,
    provider: {
        file: string|null,
    },
    env?: {
        property: string,
        developmentFile: EnvFile,
        productionFile: EnvFile,
    },
};

type ReactInstallation = Installation & {
    project: ReactProjectInfo,
    notifier: TaskNotifier,
};

export class PlugReactSdk extends JavaScriptSdk {
    private readonly codemod: CodemodConfiguration;

    private readonly bundlers: Bundlers[];

    private readonly importResolver: ImportResolver;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.codemod = configuration.codemod;
        this.bundlers = configuration.bundlers;
        this.importResolver = configuration.importResolver;
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const componentsImportPath = await this.importResolver.getImportPath(
            installation.configuration.paths.components,
            installation.configuration.paths.examples,
        );

        const generator = new PlugReactExampleGenerator({
            fileSystem: this.fileSystem,
            options: {
                language: await this.isTypeScriptProject()
                    ? CodeLanguage.TYPESCRIPT_XML
                    : CodeLanguage.JAVASCRIPT_XML,
                code: {
                    importPaths: {
                        slot: componentsImportPath,
                    },
                    files: {
                        slot: {
                            directory: installation.configuration.paths.components,
                        },
                        page: {
                            directory: installation.configuration.paths.examples,
                        },
                    },
                },
            },
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
            dependencies: ['@croct/plug-react'],
            tasks: this.getInstallationTasks({
                ...installation,
                project: projectInfo,
            }),
            configuration: configuration,
        };
    }

    private async getProjectInfo(): Promise<ReactProjectInfo> {
        const sourceDirectory = 'src';
        const envProperty = await this.getEnvVarProperty();
        const projectDirectory = this.projectDirectory.get();

        return {
            typescript: await this.isTypeScriptProject(),
            sourceDirectory: sourceDirectory,
            provider: {
                file: await this.locateFile(
                    ...['App', 'main', 'index']
                        .flatMap(name => ['js', 'jsx', 'ts', 'tsx'].map(ext => `${name}.${ext}`))
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

    private getInstallationTasks(installation: Omit<ReactInstallation, 'notifier'>): Task[] {
        const tasks: Task[] = [];
        const projectEnv = installation.project.env;
        const {applications} = installation.configuration;

        if (projectEnv !== undefined) {
            const {developmentFile, productionFile, property} = projectEnv;
            const variable = property.split('.').pop()!;

            tasks.push({
                title: 'Setup environment variables',
                task: async notifier => {
                    try {
                        notifier.update('Updating environment variables');

                        await Promise.all([
                            developmentFile.setVariable(variable, applications.developmentPublicId),
                            applications.productionPublicId === undefined
                                ? Promise.resolve()
                                : productionFile.setVariable(variable, applications.productionPublicId),
                        ]);

                        notifier.confirm('Environment variables updated');
                    } catch (error) {
                        notifier.alert('Failed to update environment variables', HelpfulError.formatMessage(error));
                    }
                },
            });
        }

        tasks.push({
            title: 'Configure provider',
            task: async notifier => {
                const providerFile = installation.project.provider.file;

                try {
                    if (providerFile === null) {
                        // @todo add help link to documentation
                        notifier.alert('No root component found');
                    } else {
                        notifier.update('Configuring provider');

                        await this.installProvider(providerFile, {
                            props: {
                                appId: PlugReactSdk.getAppIdProperty(applications, projectEnv?.property),
                            },
                        });

                        notifier.confirm('Provider configured');
                    }
                } catch (error) {
                    notifier.alert('Failed to install provider', HelpfulError.formatMessage(error));
                }
            },
        });

        return tasks;
    }

    private async installProvider(file: string, options: WrapperOptions): Promise<void> {
        const codemod = this.codemod.provider;

        await codemod.apply(this.fileSystem.joinPaths(this.projectDirectory.get(), file), options);
    }

    private async getEnvVarProperty(): Promise<string|null> {
        for (const bundler of this.bundlers) {
            if (await this.packageManager.hasDependency(bundler.package)) {
                return `${bundler.prefix}CROCT_APP_ID`;
            }
        }

        return null;
    }

    private static getAppIdProperty(
        applicationIds: ResolvedConfiguration['applications'],
        env?: string,
    ): AttributeType {
        if (env !== undefined) {
            return {
                type: 'reference',
                path: env.split('.'),
            };
        }

        if (applicationIds.productionPublicId === undefined) {
            return {
                type: 'literal',
                value: applicationIds.developmentPublicId,
            };
        }

        return {
            type: 'ternary',
            condition: {
                operator: '===',
                left: {
                    type: 'reference',
                    path: ['process', 'env', 'NODE_ENV'],
                },
                right: {
                    type: 'literal',
                    value: 'production',
                },
            },
            consequent: {
                type: 'literal',
                value: applicationIds.productionPublicId,
            },
            alternate: {
                type: 'literal',
                value: applicationIds.developmentPublicId,
            },
        };
    }
}
