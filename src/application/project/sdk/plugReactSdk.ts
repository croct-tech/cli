import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {InstallationPlan, JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {WorkspaceApi} from '@/application/api/workspace';
import {Codemod} from '@/application/project/sdk/code/codemod';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {formatMessage} from '@/application/error';
import {PropertyType, WrapperOptions} from '@/application/project/sdk/code/jsx/addWrapper';
import {EnvFile} from '@/application/project/envFile';
import {CodeLanguage, ExampleFile} from '@/application/project/example/example';
import {PlugReactExampleGenerator} from '@/application/project/example/slot/plugReactExampleGenerator';
import {Linter} from '@/application/project/linter';
import {FileSystem} from '@/application/fs/fileSystem';
import {JavaScriptProjectManager} from '@/application/project/manager/javaScriptProjectManager';
import {ResolvedConfiguration} from '@/application/project/configuration/configuration';
import {ApplicationPlatform} from '@/application/model/application';
import {Slot} from '@/application/model/slot';

type ApiConfiguration = {
    workspace: WorkspaceApi,
};

type CodemodConfiguration = {
    provider: Codemod<string, WrapperOptions>,
};

type Bundlers = {
    package: string,
    prefix: string,
};

export type Configuration = {
    projectManager: JavaScriptProjectManager,
    fileSystem: FileSystem,
    api: ApiConfiguration,
    linter: Linter,
    codemod: CodemodConfiguration,
    bundlers: Bundlers[],
};

type ReactProjectInfo = {
    typescript: boolean,
    sourceDirectory: string,
    sdk: {
        package: string,
    },
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

export class PlugReactSdk extends JavaScriptSdk implements SdkResolver<Sdk|null> {
    private readonly codemod: CodemodConfiguration;

    private readonly bundlers: Bundlers[];

    public constructor(config: Configuration) {
        super({
            projectManager: config.projectManager,
            fileSystem: config.fileSystem,
            linter: config.linter,
            workspaceApi: config.api.workspace,
        });

        this.codemod = config.codemod;
        this.bundlers = config.bundlers;
    }

    public getPackage(): string {
        return '@croct/plug-react';
    }

    public getPlatform(): ApplicationPlatform {
        return ApplicationPlatform.REACT;
    }

    public async resolve(hint?: string): Promise<Sdk | null> {
        if (hint !== undefined) {
            return Promise.resolve(hint.toLowerCase() === this.getPlatform().toLowerCase() ? this : null);
        }

        const hints = await Promise.all([
            this.projectManager.isPackageListed(this.getPackage()),
            this.projectManager.isPackageListed('react'),
        ]);

        return hints.some(Boolean) ? this : null;
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const componentsImportPath = await this.projectManager.getImportPath(
            installation.configuration.paths.components,
            installation.configuration.paths.examples,
        );

        const generator = new PlugReactExampleGenerator({
            fileSystem: this.fileSystem,
            options: {
                language: await this.projectManager.isTypeScriptProject()
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

        return {
            typescript: await this.projectManager.isTypeScriptProject(),
            sourceDirectory: sourceDirectory,
            sdk: {
                package: this.getPackage(),
            },
            provider: {
                file: await this.projectManager.locateFile(
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
                        this.fileSystem.joinPaths(this.projectManager.getRootPath(), '.env.production'),
                    ),
                    developmentFile: new EnvFile(
                        this.fileSystem,
                        this.fileSystem.joinPaths(this.projectManager.getRootPath(), '.env.development'),
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
                        notifier.alert('Failed to update environment variables', formatMessage(error));
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
                    notifier.alert('Failed to install provider', formatMessage(error));
                }
            },
        });

        return tasks;
    }

    private async installProvider(file: string, options: WrapperOptions): Promise<void> {
        const codemod = this.codemod.provider;

        await codemod.apply(this.fileSystem.joinPaths(this.projectManager.getRootPath(), file), options);
    }

    private async getEnvVarProperty(): Promise<string|null> {
        for (const bundler of this.bundlers) {
            if (await this.projectManager.isPackageListed(bundler.package)) {
                return `${bundler.prefix}CROCT_APP_ID`;
            }
        }

        return null;
    }

    private static getAppIdProperty(applicationIds: ResolvedConfiguration['applications'], env?: string): PropertyType {
        if (env === undefined) {
            return {
                type: 'literal',
                value: applicationIds.developmentPublicId,
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
