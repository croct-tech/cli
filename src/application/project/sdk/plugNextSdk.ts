import {Installation, SdkError} from '@/application/project/sdk/sdk';
import {
    Configuration as JavaScriptSdkConfiguration,
    InstallationPlan,
    JavaScriptSdk,
} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationApi, GeneratedApiKey} from '@/application/api/application';
import {WorkspaceApi} from '@/application/api/workspace';
import {EnvFile} from '@/application/project/code/envFile';
import {UserApi} from '@/application/api/user';
import {NextConfig, parseNextJsConfig} from '@/application/project/code/transformation/javascript/parseNextJsConfig';
import {Codemod, CodemodOptions} from '@/application/project/code/transformation/codemod';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import type {
    LayoutComponentOptions,
} from '@/application/project/code/transformation/javascript/nextJsLayoutComponentCodemod';
import type {AppComponentOptions} from '@/application/project/code/transformation/javascript/nextJsAppComponentCodemod';
import {CodeLanguage, ExampleFile} from '@/application/project/code/generation/example';
import {
    NextExampleRouter,
    PlugNextExampleGenerator,
} from '@/application/project/code/generation/slot/plugNextExampleGenerator';
import {ApiError} from '@/application/api/error';
import {Slot} from '@/application/model/slot';
import {HelpfulError} from '@/application/error';
import {ImportResolver} from '@/application/project/import/importResolver';
import {ApiKeyPermission} from '@/application/model/application';
import {PlugReactExampleGenerator} from '@/application/project/code/generation/slot/plugReactExampleGenerator';

type CodemodConfiguration = {
    middleware: Codemod<string>,
    fallbackProvider: Codemod<string, AppComponentOptions>,
    appRouterProvider: Codemod<string, LayoutComponentOptions>,
    pageRouterProvider: Codemod<string, AppComponentOptions>,
};

export type Configuration = JavaScriptSdkConfiguration & {
    codemod: CodemodConfiguration,
    importResolver: ImportResolver,
    userApi: UserApi,
    workspaceApi: WorkspaceApi,
    applicationApi: ApplicationApi,
};

type NextRouter = 'app' | 'page';

type NextProjectInfo = {
    fallbackMode: boolean,
    typescript: boolean,
    router: NextRouter,
    sourceDirectory: string,
    pageDirectory: string,
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

export class PlugNextSdk extends JavaScriptSdk {
    private readonly userApi: UserApi;

    private readonly applicationApi: ApplicationApi;

    private readonly codemod: CodemodConfiguration;

    private readonly importResolver: ImportResolver;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.codemod = configuration.codemod;
        this.importResolver = configuration.importResolver;
        this.userApi = configuration.userApi;
        this.applicationApi = configuration.applicationApi;
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const [router, isTypescript, fallbackMode] = await Promise.all([
            this.detectRouter(),
            this.isTypeScriptProject(),
            this.isFallbackMode(),
        ]);
        const componentDirectory = installation.configuration.paths.components;
        const pageDirectory = this.fileSystem.joinPaths(
            installation.configuration.paths.examples,
            slot.slug,
        );

        const componentsImportPath = await this.importResolver.getImportPath(componentDirectory, pageDirectory);

        const generator = fallbackMode
            ? new PlugReactExampleGenerator({
                fileSystem: this.fileSystem,
                options: {
                    language: isTypescript
                        ? CodeLanguage.TYPESCRIPT_XML
                        : CodeLanguage.JAVASCRIPT_XML,
                    code: {
                        importPaths: {
                            slot: componentsImportPath,
                        },
                        files: {
                            slot: {
                                directory: componentDirectory,
                            },
                            page: {
                                directory: pageDirectory,
                                name: 'index',
                            },
                        },
                    },
                },
            })
            : new PlugNextExampleGenerator({
                fileSystem: this.fileSystem,
                options: {
                    router: router === 'page' ? NextExampleRouter.PAGE : NextExampleRouter.APP,
                    language: isTypescript
                        ? CodeLanguage.TYPESCRIPT_XML
                        : CodeLanguage.JAVASCRIPT_XML,
                    code: {
                        importPaths: {
                            slot: componentsImportPath,
                        },
                        files: {
                            slot: {
                                directory: this.fileSystem.joinPaths(componentDirectory, '%name%'),
                                name: 'index',
                            },
                            page: {
                                directory: pageDirectory,
                                name: router === 'page' ? 'index' : 'page',
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
        const {configuration, output} = installation;
        const [{i18n}, projectInfo] = await Promise.all([this.getConfig(), this.getProjectInfo()]);

        if (projectInfo.fallbackMode) {
            output.announce({
                semantics: 'warning',
                title: 'Fallback mode',
                message: 'Next.js SDK requires version 13 or newer, so React SDK will be installed instead.',
            });
        }

        const filteredLocales = configuration.locales.filter(
            locale => i18n.locales.includes(locale) || locale === configuration.defaultLocale,
        );
        const locales = filteredLocales.length > 0 ? filteredLocales : i18n.locales;
        const defaultLocale = i18n.defaultLocale !== undefined && locales.includes(i18n.defaultLocale)
            ? i18n.defaultLocale
            : configuration.defaultLocale;

        return {
            dependencies: [projectInfo.fallbackMode ? '@croct/plug-react' : '@croct/plug-next'],
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
        const [isTypescript, directory, fallbackMode] = await Promise.all([
            this.isTypeScriptProject(),
            this.getPageDirectory(),
            this.isFallbackMode(),
        ]);

        const project: Pick<NextProjectInfo, 'typescript' | 'router' | 'sourceDirectory' | 'pageDirectory'> = {
            typescript: isTypescript,
            router: await this.detectRouter(directory),
            sourceDirectory: directory.startsWith('src') ? 'src' : '.',
            pageDirectory: directory,
        };

        const [middlewareFile, providerComponentFile] = await Promise.all([
            this.locateFile(
                ...['middleware.js', 'middleware.ts']
                    .map(file => this.fileSystem.joinPaths(project.sourceDirectory, file)),
            ),
            this.locateFile(
                ...(project.router === 'app'
                    ? [this.fileSystem.joinPaths('app', 'layout.jsx'), this.fileSystem.joinPaths('app', 'layout.tsx')]
                    : [this.fileSystem.joinPaths('pages', '_app.jsx'), this.fileSystem.joinPaths('pages', '_app.tsx')]
                ).map(file => this.fileSystem.joinPaths(project.sourceDirectory, file)),
            ),
        ]);

        const extension = project.typescript ? 'ts' : 'js';
        const projectDirectory = this.projectDirectory.get();

        return {
            ...project,
            fallbackMode: fallbackMode,
            env: {
                localFile: new EnvFile(
                    this.fileSystem,
                    this.fileSystem.joinPaths(projectDirectory, '.env.local'),
                ),
                developmentFile: new EnvFile(
                    this.fileSystem,
                    this.fileSystem.joinPaths(projectDirectory, '.env.development'),
                ),
                productionFile: new EnvFile(
                    this.fileSystem,
                    this.fileSystem.joinPaths(projectDirectory, '.env.production'),
                ),
            },
            middleware: {
                file: middlewareFile ?? this.fileSystem.joinPaths(project.sourceDirectory, `middleware.${extension}`),
            },
            provider: {
                file: providerComponentFile
                    ?? (
                        project.router === 'app'
                            ? this.fileSystem.joinPaths('app', `layout.${extension}x`)
                            : this.fileSystem.joinPaths('pages', `_app.${extension}x`)
                    ),
            },
        };
    }

    private getInstallationTasks(installation: Omit<NextInstallation, 'notifier'>): Task[] {
        const tasks: Task[] = [];

        if (!installation.project.fallbackMode) {
            tasks.push({
                title: 'Configure middleware',
                task: async notifier => {
                    try {
                        await this.updateCode(this.codemod.middleware, installation.project.middleware.file);

                        notifier.confirm('Middleware configured');
                    } catch (error) {
                        notifier.alert('Failed to install middleware', HelpfulError.formatMessage(error));
                    }
                },
            });
        }

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
                    notifier.alert('Failed to install provider', HelpfulError.formatMessage(error));
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
                    notifier.alert('Failed to update .env.local', HelpfulError.formatMessage(error));
                }
            },
        });

        return tasks;
    }

    private installProvider(installation: NextInstallation): Promise<void> {
        return this.updateCode(
            this.getProviderCodemod(installation),
            installation.project.provider.file,
            {typescript: installation.project.typescript},
        );
    }

    private getProviderCodemod(
        installation: NextInstallation,
    ): Codemod<string, AppComponentOptions|LayoutComponentOptions> {
        if (installation.project.fallbackMode) {
            return this.codemod.fallbackProvider;
        }

        return installation.project.router === 'app'
            ? this.codemod.appRouterProvider
            : this.codemod.pageRouterProvider;
    }

    private async updateCode<O extends CodemodOptions>(
        codemod: Codemod<string, O>,
        path: string,
        options?: O,
    ): Promise<void> {
        await codemod.apply(this.fileSystem.joinPaths(this.projectDirectory.get(), path), options);
    }

    private async updateEnvVariables(installation: NextInstallation): Promise<void> {
        const {project: {env: plan}, configuration: {applications}, notifier} = installation;

        if (!await plan.localFile.hasVariable(NextEnvVar.API_KEY)) {
            notifier.update('Loading information');

            const user = await this.userApi.getUser();

            notifier.update('Creating API key');

            let apiKey: GeneratedApiKey;

            try {
                apiKey = await this.applicationApi.createApiKey({
                    name: `${user.username} CLI`,
                    applicationId: applications.developmentId,
                    permissions: [ApiKeyPermission.ISSUE_TOKEN],
                });
            } catch (error) {
                if (error instanceof HelpfulError) {
                    throw new SdkError(
                        error instanceof ApiError && error.isAccessDenied()
                            ? 'Your user does not have permission to create an API key'
                            : error.message,
                        error.help,
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

    private async getPageDirectory(): Promise<string> {
        return (await this.locateFile(
            'app',
            this.fileSystem.joinPaths('src', 'app'),
            'pages',
            this.fileSystem.joinPaths('src', 'pages'),
        )) ?? 'app';
    }

    private async getConfig(): Promise<NextConfig> {
        const searchPaths = ['js', 'mjs', 'ts', 'mts'].map(ext => `next.config.${ext}`);
        const config = await this.readFile(...searchPaths).catch(() => null);

        if (config === null) {
            return {
                i18n: {
                    locales: [],
                    defaultLocale: '',
                },
            };
        }

        return parseNextJsConfig(config);
    }

    private async isFallbackMode(): Promise<boolean> {
        return !await this.packageManager.hasDependency('next', '>=13');
    }
}
