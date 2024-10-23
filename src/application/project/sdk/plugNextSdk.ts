import {access, readFile} from 'fs/promises';
import {join} from 'path';
import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {InstallationPlan, JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';
import {ApplicationApi, GeneratedApiKey} from '@/application/api/application';
import {ProjectManager} from '@/application/project/projectManager';
import {WorkspaceApi} from '@/application/api/workspace';
import {EnvFile} from '@/application/project/envFile';
import {UserApi} from '@/application/api/user';
import {NextConfig, parseConfig} from '@/application/project/sdk/code/nextjs/parseConfig';
import {Codemod} from '@/application/project/sdk/code/codemod';
import {hasImport} from '@/application/project/sdk/code/javascript/hasImport';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {formatMessage} from '@/application/error';
import type {ComponentOptions} from '@/application/project/sdk/code/nextjs/createLayoutComponent';
import type {ComponentOptions} from '@/application/project/sdk/code/nextjs/createAppComponent';

type ApiConfiguration = {
    user: UserApi,
    workspace: WorkspaceApi,
    application: ApplicationApi,
};

type CodemodConfiguration = {
    middleware: Codemod<string>,
    appRouterProvider: Codemod<string, ComponentOptions>,
    pageRouterProvider: Codemod<string, ComponentOptions>,
};

export type Configuration = {
    projectManager: ProjectManager,
    api: ApiConfiguration,
    codemod: CodemodConfiguration,
};

type NextProjectInfo = {
    typescript: boolean,
    router: 'app' | 'page',
    sourceDirectory: string,
    sdk: {
        package: string,
        installed: boolean,
    },
    middleware: {
        file: string,
        new: boolean,
        installed: boolean,
    },
    provider: {
        file: string,
        new: boolean,
        installed: boolean,
    },
    env: {
        file: EnvFile,
        installed: {
            apiKey: boolean,
            appId: boolean,
        },
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

export class PlugNextSdk extends JavaScriptSdk implements SdkResolver {
    private readonly api: ApiConfiguration;

    private readonly codemod: CodemodConfiguration;

    public constructor(config: Configuration) {
        super(config.projectManager);

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
            this.projectManager.isPackageListed(this.getPackage()),
            this.projectManager.isPackageListed('next'),
        ]);

        return hints.some(Boolean) ? this : null;
    }

    protected async getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        const {configuration} = installation;
        const [{i18n}, projectInfo] = await Promise.all([this.getConfig(), this.getProjectInfo()]);

        return {
            tasks: await this.getInstallationTasks({
                ...installation,
                project: projectInfo,
            }),
            configuration: {
                ...configuration,
                locales: i18n.locales ?? configuration.locales,
            },
        };
    }

    private async getProjectInfo(): Promise<NextProjectInfo> {
        const [isTypescript, directory] = await Promise.all([
            this.projectManager.isPackageListed('typescript'),
            this.locateFile(['app', 'src/app', 'pages', 'src/pages'])
                .then(path => path ?? 'app'),
        ]);

        const project: Pick<NextProjectInfo, 'typescript' | 'router' | 'sourceDirectory'> = {
            typescript: isTypescript,
            router: directory.endsWith('app') ? 'app' : 'page',
            sourceDirectory: directory.startsWith('src') ? 'src' : './',
        };

        const sdkPackage = this.getPackage();
        const [middlewareFile, providerComponentFile, isSdkInstalled] = await Promise.all([
            this.locateFile(
                ['middleware.js', 'middleware.ts'].map(file => join(project.sourceDirectory, file)),
            ),
            this.locateFile(
                (project.router === 'app' ? ['app/layout.jsx', 'app/layout.tsx'] : ['_app.jsx', '_app.tsx'])
                    .map(file => join(project.sourceDirectory, file)),
            ),
            this.projectManager.isPackageListed(sdkPackage),
        ]);

        const [middlewareSource, providerSource] = await Promise.all([
            middlewareFile === null ? null : this.readFile([middlewareFile]),
            providerComponentFile === null ? null : this.readFile([providerComponentFile]),
        ]);

        const envFile = new EnvFile(join(this.projectManager.getDirectory(), '.env.local'));
        const [apiKeyVar, appIdVar] = await Promise.all([
            envFile.hasVariable(NextEnvVar.API_KEY),
            envFile.hasVariable(NextEnvVar.APP_ID),
        ]);

        const extension = project.typescript ? 'ts' : 'js';

        return {
            ...project,
            sdk: {
                package: sdkPackage,
                installed: isSdkInstalled,
            },
            env: {
                file: envFile,
                installed: {
                    apiKey: apiKeyVar,
                    appId: appIdVar,
                },
            },
            middleware: {
                file: middlewareFile ?? join(project.sourceDirectory, `middleware.${extension}`),
                new: middlewareFile === null,
                installed: PlugNextSdk.hasImport(middlewareSource, '@croct/plug-next/middleware'),
            },
            provider: {
                file: providerComponentFile ?? (
                    `${project.router === 'app' ? 'app/layout' : '_app'}.${extension}x`
                ),
                new: providerComponentFile === null,
                installed: PlugNextSdk.hasImport(providerSource, '@croct/plug-next/CroctProvider'),
            },
        };
    }

    private async getInstallationTasks(installation: Omit<NextInstallation, 'notifier'>): Promise<Task[]> {
        const {project} = installation;
        const tasks: Task[] = [];

        if (!project.sdk.installed) {
            tasks.push({
                title: `Install ${this.getPackage()}`,
                task: async notifier => {
                    try {
                        await this.projectManager.installPackage(this.getPackage());

                        notifier.confirm('SDK installed');
                    } catch (error) {
                        notifier.alert('Failed to install SDK', formatMessage(error));
                    }
                },
            });
        }

        const isMiddlewareInstalled = project.middleware.installed;

        if (!isMiddlewareInstalled) {
            const isNew = project.middleware.new;

            tasks.push({
                title: isNew
                    ? `Create ${installation.project.middleware.file}`
                    : `Configure ${installation.project.middleware.file}`,
                task: async notifier => {
                    try {
                        await this.installMiddleware({
                            ...installation,
                            notifier: notifier,
                        });

                        notifier.confirm(`Middleware ${isNew ? 'created' : 'configured'}`);
                    } catch (error) {
                        notifier.alert('Failed to install middleware', formatMessage(error));
                    }
                },
            });
        }

        const isProviderInstalled = project.provider.installed;

        if (!isProviderInstalled) {
            const isNew = project.provider.new;

            tasks.push({
                title: isNew
                    ? `Create ${installation.project.provider.file}`
                    : `Configure ${installation.project.provider.file}`,
                task: async notifier => {
                    try {
                        await this.installProvider({
                            ...installation,
                            notifier: notifier,
                        });

                        notifier.confirm(`Provider ${isNew ? 'created' : 'configured'}`);
                    } catch (error) {
                        notifier.alert('Failed to install provider', formatMessage(error));
                    }
                },
            });
        }

        const isEnvInstalled = project.env.installed.apiKey && project.env.installed.appId;

        if (!isEnvInstalled) {
            const {file} = project.env;
            const fileName = file.getName();
            const exists = await file.exists();

            tasks.push({
                title: exists
                    ? `Update ${fileName}`
                    : `Create ${fileName}`,
                task: async notifier => {
                    try {
                        await this.updateEnvFile({
                            ...installation,
                            notifier: notifier,
                        });

                        notifier.confirm(`Env file ${exists ? 'updated' : 'created'}`);
                    } catch (error) {
                        notifier.alert('Failed to update .env.local', formatMessage(error));
                    }
                },
            });
        }

        return tasks;
    }

    private installProvider(installation: NextInstallation): Promise<boolean> {
        return this.updateCode(
            installation.project.router === 'app'
                ? this.codemod.appRouterProvider
                : this.codemod.pageRouterProvider,
            installation.project.provider.file,
            {typescript: installation.project.typescript},
        );
    }

    private installMiddleware(installation: NextInstallation): Promise<boolean> {
        return this.updateCode(this.codemod.middleware, installation.project.middleware.file);
    }

    private async updateCode<O extends Record<string, any>>(
        codemod: Codemod<string, O>,
        path: string,
        options?: O,
    ): Promise<boolean> {
        return (await codemod.apply(join(this.projectManager.getDirectory(), path), options)).modified;
    }

    private async updateEnvFile(installation: NextInstallation): Promise<void> {
        const {project: {env: plan}, configuration, notifier} = installation;

        notifier.update('Loading application information');

        const {api} = this;

        try {
            const [user, application] = await Promise.all([
                await api.user.getUser(),
                await api.workspace.getApplication({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    applicationSlug: configuration.applications.development,
                }),
            ]);

            if (application === null) {
                notifier.alert('Application not found');

                return;
            }

            let apiKey: GeneratedApiKey|null = null;

            if (!plan.installed.apiKey) {
                notifier.update('Creating API key');

                apiKey = await api.application.createApiKey({
                    name: `${user.username} CLI`,
                    applicationId: application.id,
                    permissions: {
                        tokenIssue: true,
                    },
                });
            }

            await plan.file.setVariables({
                [NextEnvVar.APP_ID]: application.publicId,
                ...(apiKey !== null ? {[NextEnvVar.API_KEY]: apiKey.secret} : {}),
            });

            notifier.confirm('.env.local updated');
        } catch (error) {
            notifier.alert(`Failed to update ${plan.file.getName()}`);
        }
    }

    private async getConfig(): Promise<NextConfig> {
        const config = await this.readFile([
            'next.config.js',
            'next.config.mjs',
            'next.config.ts',
            'next.config.mts',
        ]);

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

    private async readFile(fileNames: string[]): Promise<string | null> {
        const filePath = await this.locateFile(fileNames);

        if (filePath === null) {
            return null;
        }

        const directory = this.projectManager.getDirectory();

        try {
            return await readFile(join(directory, filePath), 'utf8');
        } catch {
            // Suppress error
        }

        return null;
    }

    private async locateFile(fileNames: string[]): Promise<string | null> {
        const directory = this.projectManager.getDirectory();

        for (const filename of fileNames) {
            const fullPath = join(directory, filename);

            try {
                await access(fullPath);

                return filename;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    continue;
                }

                throw error;
            }
        }

        return null;
    }

    private static hasImport(source: string|null, moduleName: string): boolean {
        if (source === null) {
            return false;
        }

        try {
            return hasImport(source, {moduleName: moduleName});
        } catch {
            return false;
        }
    }
}
