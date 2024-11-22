import {join} from 'path';
import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {InstallationPlan, JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';
import {ApplicationApi} from '@/application/api/application';
import {JavaScriptProject} from '@/application/project/project';
import {WorkspaceApi} from '@/application/api/workspace';
import {EnvFile} from '@/application/project/envFile';
import {UserApi} from '@/application/api/user';
import {NextConfig, parseConfig} from '@/application/project/sdk/code/nextjs/parseConfig';
import {Codemod, CodemodOptions} from '@/application/project/sdk/code/codemod';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {formatMessage} from '@/application/error';
import type {LayoutComponentOptions} from '@/application/project/sdk/code/nextjs/createLayoutComponent';
import type {AppComponentOptions} from '@/application/project/sdk/code/nextjs/createAppComponent';

type ApiConfiguration = {
    user: UserApi,
    workspace: WorkspaceApi,
    application: ApplicationApi,
};

type CodemodConfiguration = {
    middleware: Codemod<string>,
    appRouterProvider: Codemod<string, LayoutComponentOptions>,
    pageRouterProvider: Codemod<string, AppComponentOptions>,
};

export type Configuration = {
    project: JavaScriptProject,
    api: ApiConfiguration,
    codemod: CodemodConfiguration,
};

type NextProjectInfo = {
    typescript: boolean,
    router: 'app' | 'page',
    sourceDirectory: string,
    sdk: {
        package: string,
    },
    middleware: {
        file: string,
    },
    provider: {
        file: string,
    },
    env: {
        localFile: EnvFile,
        developmentFile: EnvFile,
        productionFile: EnvFile,
    },
};

type NextInstallation = Installation & {
    project: NextProjectInfo,
    notifier: TaskNotifier,
};

enum NextEnvVar {
    API_KEY = 'CROCT_API_KEY',
    APP_ID = 'NEXT_PUBLIC_CROCT_APP_ID',
}

export class PlugNextSdk extends JavaScriptSdk implements SdkResolver<Sdk|null> {
    private readonly api: ApiConfiguration;

    private readonly codemod: CodemodConfiguration;

    public constructor(config: Configuration) {
        super({
            project: config.project,
            workspaceApi: config.api.workspace,
        });

        this.api = config.api;
        this.codemod = config.codemod;
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
            this.project.isPackageListed('next'),
        ]);

        return hints.some(Boolean) ? this : null;
    }

    protected async getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        const {configuration} = installation;
        const [{i18n}, projectInfo] = await Promise.all([this.getConfig(), this.getProjectInfo()]);

        return {
            tasks: this.getInstallationTasks({
                ...installation,
                project: projectInfo,
            }),
            configuration: {
                ...configuration,
                locales: configuration.locales.filter(locale => i18n.locales.includes(locale)),
            },
        };
    }

    private async getProjectInfo(): Promise<NextProjectInfo> {
        const [isTypescript, directory] = await Promise.all([
            this.project.isTypeScriptProject(),
            this.project
                .locateFile('app', 'src/app', 'pages', 'src/pages')
                .then(path => path ?? 'app'),
        ]);

        const project: Pick<NextProjectInfo, 'typescript' | 'router' | 'sourceDirectory'> = {
            typescript: isTypescript,
            router: directory.endsWith('app') ? 'app' : 'page',
            sourceDirectory: directory.startsWith('src') ? 'src' : './',
        };

        const sdkPackage = this.getPackage();
        const [middlewareFile, providerComponentFile] = await Promise.all([
            this.project.locateFile(
                ...['middleware.js', 'middleware.ts']
                    .map(file => join(project.sourceDirectory, file)),
            ),
            this.project.locateFile(
                ...(project.router === 'app' ? ['app/layout.jsx', 'app/layout.tsx'] : ['_app.jsx', '_app.tsx'])
                    .map(file => join(project.sourceDirectory, file)),
            ),
        ]);

        const extension = project.typescript ? 'ts' : 'js';

        return {
            ...project,
            sdk: {
                package: sdkPackage,
            },
            env: {
                localFile: new EnvFile(join(this.project.getRootPath(), '.env.local')),
                developmentFile: new EnvFile(join(this.project.getRootPath(), '.env.development')),
                productionFile: new EnvFile(join(this.project.getRootPath(), '.env.production')),
            },
            middleware: {
                file: middlewareFile ?? join(project.sourceDirectory, `middleware.${extension}`),
            },
            provider: {
                file: providerComponentFile ?? (`${project.router === 'app' ? 'app/layout' : '_app'}.${extension}x`),
            },
        };
    }

    private getInstallationTasks(installation: Omit<NextInstallation, 'notifier'>): Task[] {
        const tasks: Task[] = [];

        tasks.push({
            title: 'Configure middleware',
            task: async notifier => {
                try {
                    await this.installMiddleware({
                        ...installation,
                        notifier: notifier,
                    });

                    notifier.confirm('Middleware configured');
                } catch (error) {
                    notifier.alert('Failed to install middleware', formatMessage(error));
                }
            },
        });

        tasks.push({
            title: 'Configure provider',
            task: async notifier => {
                try {
                    await this.installProvider({
                        ...installation,
                        notifier: notifier,
                    });

                    notifier.confirm('Provider configured');
                } catch (error) {
                    notifier.alert('Failed to install provider', formatMessage(error));
                }
            },
        });

        tasks.push({
            title: 'Setup environment variables',
            task: async notifier => {
                try {
                    await this.updateEnvVariables({
                        ...installation,
                        notifier: notifier,
                    });

                    notifier.confirm('Environment variables updated');
                } catch (error) {
                    notifier.alert('Failed to update .env.local', formatMessage(error));
                }
            },
        });

        return tasks;
    }

    private installProvider(installation: NextInstallation): Promise<void> {
        return this.updateCode(
            installation.project.router === 'app'
                ? this.codemod.appRouterProvider
                : this.codemod.pageRouterProvider,
            installation.project.provider.file,
            {typescript: installation.project.typescript},
        );
    }

    private installMiddleware(installation: NextInstallation): Promise<void> {
        return this.updateCode(this.codemod.middleware, installation.project.middleware.file);
    }

    private async updateCode<O extends CodemodOptions>(
        codemod: Codemod<string, O>,
        path: string,
        options?: O,
    ): Promise<void> {
        await codemod.apply(join(this.project.getRootPath(), path), options);
    }

    private async updateEnvVariables(installation: NextInstallation): Promise<void> {
        const {project: {env: plan}, configuration: {applications}, notifier} = installation;

        const {api} = this;

        if (!await plan.localFile.hasVariable(NextEnvVar.API_KEY)) {
            try {
                notifier.update('Loading information');

                const user = await api.user.getUser();

                notifier.update('Creating API key');

                const apiKey = await api.application.createApiKey({
                    name: `${user.username} CLI`,
                    applicationId: applications.developmentId,
                    permissions: {
                        tokenIssue: true,
                    },
                });

                await plan.localFile.setVariables({
                    [NextEnvVar.API_KEY]: apiKey.secret,
                });
            } catch (error) {
                notifier.alert(`Failed to update ${plan.developmentFile.getName()}`);

                return;
            }

            try {
                await Promise.all([
                    plan.developmentFile.setVariables({
                        [NextEnvVar.APP_ID]: applications.developmentPublicId,
                    }),
                    plan.productionFile.setVariables({
                        [NextEnvVar.APP_ID]: applications.productionPublicId,
                    }),
                ]);
            } catch (error) {
                notifier.alert('Failed to update environment variables', formatMessage(error));
            }
        }
    }

    private async getConfig(): Promise<NextConfig> {
        const searchPaths = ['js', 'mjs', 'ts', 'mts'].map(ext => `next.config.${ext}`);
        const config = await this.project
            .readFile(...searchPaths)
            .catch(() => null);

        if (config === null) {
            return {
                i18n: {
                    locales: [],
                    defaultLocale: '',
                },
            };
        }

        return parseConfig(config);
    }
}
