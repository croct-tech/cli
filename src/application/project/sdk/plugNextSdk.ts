import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {InstallationPlan, JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform, Slot} from '@/application/model/entities';
import {ApplicationApi, GeneratedApiKey} from '@/application/api/application';
import {WorkspaceApi} from '@/application/api/workspace';
import {EnvFile} from '@/application/project/envFile';
import {UserApi} from '@/application/api/user';
import {NextConfig, parseConfig} from '@/application/project/sdk/code/nextjs/parseConfig';
import {Codemod, CodemodOptions} from '@/application/project/sdk/code/codemod';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {formatMessage} from '@/application/error';
import type {LayoutComponentOptions} from '@/application/project/sdk/code/nextjs/createLayoutComponent';
import type {AppComponentOptions} from '@/application/project/sdk/code/nextjs/createAppComponent';
import {CodeLanguage, ExampleFile} from '@/application/project/example/example';
import {NextExampleRouter, PlugNextExampleGenerator} from '@/application/project/example/slot/plugNextExampleGenerator';
import {Linter} from '@/application/project/linter';
import {ApiError} from '@/application/api/error';
import {Filesystem} from '@/application/filesystem/filesystem';
import {JavaScriptProjectManager} from '@/application/project/manager/javaScriptProjectManager';

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
    projectManager: JavaScriptProjectManager,
    filesystem: Filesystem,
    api: ApiConfiguration,
    linter: Linter,
    codemod: CodemodConfiguration,
};

type NextRouter = 'app' | 'page';

type NextProjectInfo = {
    typescript: boolean,
    router: NextRouter,
    sourceDirectory: string,
    pageDirectory: string,
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
            projectManager: config.projectManager,
            filesystem: config.filesystem,
            linter: config.linter,
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

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const router = await this.detectRouter();
        const componentsImportPath = await this.projectManager.getImportPath(
            installation.configuration.paths.components,
            installation.configuration.paths.examples,
        );

        const generator = new PlugNextExampleGenerator({
            router: router === 'page' ? NextExampleRouter.PAGE : NextExampleRouter.APP,
            language: await this.projectManager.isTypeScriptProject()
                ? CodeLanguage.TYPESCRIPT_XML
                : CodeLanguage.JAVASCRIPT_XML,
            code: {
                importPaths: {
                    slot: componentsImportPath,
                },
                files: {
                    slot: {
                        directory: this.filesystem.joinPaths(installation.configuration.paths.components, '%name%'),
                        name: 'index',
                    },
                    page: {
                        directory: this.filesystem.joinPaths(installation.configuration.paths.examples, slot.slug),
                        name: router === 'page' ? 'index' : 'page',
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
        const filteredLocales = configuration.locales.filter(
            locale => i18n.locales.includes(locale) || locale === configuration.defaultLocale,
        );
        const locales = filteredLocales.length > 0 ? filteredLocales : i18n.locales;
        const defaultLocale = i18n.defaultLocale !== undefined && locales.includes(i18n.defaultLocale)
            ? i18n.defaultLocale
            : configuration.defaultLocale;

        return {
            tasks: this.getInstallationTasks({
                ...installation,
                project: projectInfo,
            }),
            configuration: {
                ...configuration,
                locales: locales,
                defaultLocale: defaultLocale,
                paths: {
                    ...configuration.paths,
                    examples: projectInfo.pageDirectory,
                },
            },
        };
    }

    private async getProjectInfo(): Promise<NextProjectInfo> {
        const [isTypescript, directory] = await Promise.all([
            this.projectManager.isTypeScriptProject(),
            this.getPageDirectory(),
        ]);

        const project: Pick<NextProjectInfo, 'typescript' | 'router' | 'sourceDirectory' | 'pageDirectory'> = {
            typescript: isTypescript,
            router: await this.detectRouter(directory),
            sourceDirectory: directory.startsWith('src') ? 'src' : './',
            pageDirectory: directory,
        };

        const sdkPackage = this.getPackage();
        const [middlewareFile, providerComponentFile] = await Promise.all([
            this.projectManager.locateFile(
                ...['middleware.js', 'middleware.ts']
                    .map(file => this.filesystem.joinPaths(project.sourceDirectory, file)),
            ),
            this.projectManager.locateFile(
                ...(project.router === 'app' ? ['app/layout.jsx', 'app/layout.tsx'] : ['_app.jsx', '_app.tsx'])
                    .map(file => this.filesystem.joinPaths(project.sourceDirectory, file)),
            ),
        ]);

        const extension = project.typescript ? 'ts' : 'js';

        return {
            ...project,
            sdk: {
                package: sdkPackage,
            },
            env: {
                localFile: new EnvFile(
                    this.filesystem,
                    this.filesystem.joinPaths(this.projectManager.getRootPath(), '.env.local'),
                ),
                developmentFile: new EnvFile(
                    this.filesystem,
                    this.filesystem.joinPaths(this.projectManager.getRootPath(), '.env.development'),
                ),
                productionFile: new EnvFile(
                    this.filesystem,
                    this.filesystem.joinPaths(this.projectManager.getRootPath(), '.env.production'),
                ),
            },
            middleware: {
                file: middlewareFile ?? this.filesystem.joinPaths(project.sourceDirectory, `middleware.${extension}`),
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
        await codemod.apply(this.filesystem.joinPaths(this.projectManager.getRootPath(), path), options);
    }

    private async updateEnvVariables(installation: NextInstallation): Promise<void> {
        const {project: {env: plan}, configuration: {applications}, notifier} = installation;

        const {api} = this;

        if (!await plan.localFile.hasVariable(NextEnvVar.API_KEY)) {
            notifier.update('Loading information');

            const user = await api.user.getUser();

            notifier.update('Creating API key');

            let apiKey: GeneratedApiKey;

            try {
                apiKey = await api.application.createApiKey({
                    name: `${user.username} CLI`,
                    applicationId: applications.developmentId,
                    permissions: {
                        tokenIssue: true,
                    },
                });
            } catch (error) {
                if (error instanceof ApiError && error.isAccessDenied()) {
                    throw new ApiError(
                        'Your user does not have permission to create an API key',
                        error.details,
                    );
                }

                throw error;
            }

            await plan.localFile.setVariables({
                [NextEnvVar.API_KEY]: apiKey.secret,
            });

            await Promise.all([
                plan.developmentFile.setVariables({
                    [NextEnvVar.APP_ID]: applications.developmentPublicId,
                }),
                applications.productionPublicId === undefined
                    ? Promise.resolve()
                    : plan.productionFile.setVariables({
                        [NextEnvVar.APP_ID]: applications.productionPublicId,
                    }),
            ]);
        }
    }

    private async detectRouter(directory?: string): Promise<NextRouter> {
        return (directory ?? await this.getPageDirectory()).endsWith('pages') ? 'page' : 'app';
    }

    private getPageDirectory(): Promise<string> {
        return this.projectManager
            .locateFile('app', 'src/app', 'pages', 'src/pages')
            .then(path => path ?? 'app');
    }

    private async getConfig(): Promise<NextConfig> {
        const searchPaths = ['js', 'mjs', 'ts', 'mts'].map(ext => `next.config.${ext}`);
        const config = await this.projectManager
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
