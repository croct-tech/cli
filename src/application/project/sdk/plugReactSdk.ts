import {join} from 'path';
import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {InstallationPlan, JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';
import {JavaScriptProject} from '@/application/project/project';
import {WorkspaceApi} from '@/application/api/workspace';
import {Codemod} from '@/application/project/sdk/code/codemod';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {formatMessage} from '@/application/error';
import type {WrapperOptions} from '@/application/project/sdk/code/jsx/addWrapper';
import {EnvFile} from '@/application/project/envFile';

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
    project: JavaScriptProject,
    api: ApiConfiguration,
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

export class PlugReactSdk extends JavaScriptSdk implements SdkResolver {
    private readonly codemod: CodemodConfiguration;

    private readonly bundlers: Bundlers[];

    public constructor(config: Configuration) {
        super({
            project: config.project,
            workspaceApi: config.api.workspace,
        });

        this.codemod = config.codemod;
        this.bundlers = config.bundlers;
    }

    public getPackage(): string {
        return '@croct/plug-next';
    }

    public getPlatform(): ApplicationPlatform {
        return ApplicationPlatform.NEXT;
    }

    public async resolve(hint?: string): Promise<Sdk | null> {
        if (hint !== undefined) {
            return Promise.resolve(hint.toLowerCase() === this.getPlatform().toLowerCase() ? this : null);
        }

        const hints = await Promise.all([
            this.project.isPackageListed(this.getPackage()),
            this.project.isPackageListed('react'),
        ]);

        return hints.some(Boolean) ? this : null;
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
            typescript: await this.project.isTypeScriptProject(),
            sourceDirectory: sourceDirectory,
            sdk: {
                package: this.getPackage(),
            },
            provider: {
                file: await this.project.locateFile(
                    ...['App', 'main', 'index']
                        .flatMap(name => ['js', 'jsx', 'ts', 'tsx'].map(ext => `${name}.${ext}`))
                        .map(file => join(sourceDirectory, file)),
                ),
            },
            env: envProperty === null
                ? undefined
                : {
                    property: envProperty,
                    productionFile: new EnvFile(join(this.project.getRootPath(), '.env.production')),
                    developmentFile: new EnvFile(join(this.project.getRootPath(), '.env.development')),
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
                            productionFile.setVariable(variable, applications.productionPublicId),
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
                                appId: projectEnv === undefined
                                    ? {
                                        type: 'ternary',
                                        condition: {
                                            operator: '===',
                                            left: {
                                                type: 'property',
                                                path: ['process', 'env', 'NODE_ENV'],
                                            },
                                            right: {
                                                type: 'literal',
                                                value: 'production',
                                            },
                                        },
                                        consequent: {
                                            type: 'literal',
                                            value: applications.productionPublicId,
                                        },
                                        alternate: {
                                            type: 'literal',
                                            value: applications.developmentPublicId,
                                        },
                                    }
                                    : {
                                        type: 'property',
                                        path: projectEnv.property.split('.'),
                                    },
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

        await codemod.apply(join(this.project.getRootPath(), file), options);
    }

    private async getEnvVarProperty(): Promise<string|null> {
        for (const bundler of this.bundlers) {
            if (await this.project.isPackageListed(bundler.package)) {
                return `${bundler.prefix}CROCT_APP_ID`;
            }
        }

        return null;
    }
}
