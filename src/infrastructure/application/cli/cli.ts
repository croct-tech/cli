import {join} from 'path';
import {Readable, Writable} from 'stream';
import {ConsoleInput} from '@/infrastructure/application/cli/io/consoleInput';
import {ConsoleOutput, ExitCallback} from '@/infrastructure/application/cli/io/consoleOutput';
import {HttpPollingListener} from '@/infrastructure/application/cli/io/httpPollingListener';
import {NodeProject} from '@/infrastructure/project/nodeProject';
import {Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {PlugJsSdk} from '@/application/project/sdk/plugJsSdk';
import {PlugReactSdk} from '@/application/project/sdk/plugReactSdk';
import {PlugNextSdk} from '@/application/project/sdk/plugNextSdk';
import {InitCommand, InitInput} from '@/application/cli/command/init';
import {LoginCommand, LoginInput} from '@/application/cli/command/login';
import {LogoutCommand} from '@/application/cli/command/logout';
import {Input} from '@/application/cli/io/input';
import {JsonFileConfiguration} from '@/application/project/configuration/file/jsonFileConfiguration';
import {GraphqlClient} from '@/infrastructure/graphql';
import {FetchGraphqlClient} from '@/infrastructure/graphql/fetchGraphqlClient';
import {JavaScriptProject, Project} from '@/application/project/project';
import {UserApi} from '@/application/api/user';
import {OrganizationApi} from '@/application/api/organization';
import {WorkspaceApi} from '@/application/api/workspace';
import {GraphqlUserApi} from '@/infrastructure/application/api/user';
import {GraphqlOrganizationApi} from '@/infrastructure/application/api/organization';
import {GraphqlWorkspaceApi} from '@/infrastructure/application/api/workspace';
import {OrganizationForm} from '@/application/cli/form/organization/organizationForm';
import {WorkspaceForm} from '@/application/cli/form/workspace/workspaceForm';
import {ApplicationForm} from '@/application/cli/form/application/applicationForm';
import {ApplicationApi} from '@/application/api/application';
import {GraphqlApplicationApi} from '@/infrastructure/application/api/application';
import {Authenticator} from '@/application/cli/authentication/authenticator';
import {TokenFileAuthenticator} from '@/application/cli/authentication/authenticator/tokenFileAuthenticator';
import {
    CredentialsAuthenticator,
    CredentialsInput,
} from '@/application/cli/authentication/authenticator/credentialsAuthenticator';
import {SignInForm} from '@/application/cli/form/auth/signInForm';
import {AuthenticationListener} from '@/application/cli/authentication/authentication';
import {SignUpForm} from '@/application/cli/form/auth/signUpForm';
import {Command, CommandInput} from '@/application/cli/command/command';
import {AdminCommand, AdminInput} from '@/application/cli/command/admin';
import {AddWrapper} from '@/application/project/sdk/code/jsx/addWrapper';
import {ParseCode} from '@/application/project/sdk/code/parseCode';
import {ConfigureMiddleware} from '@/application/project/sdk/code/nextjs/configureMiddleware';
import {Linter} from '@/application/project/linter';
import {LintCode} from '@/application/project/sdk/code/lintCode';
import {TransformFile} from '@/application/project/sdk/code/transformFile';
import {CreateLayoutComponent} from '@/application/project/sdk/code/nextjs/createLayoutComponent';
import {CreateAppComponent} from '@/application/project/sdk/code/nextjs/createAppComponent';
import {JavaScriptLinter} from '@/infrastructure/project/javaScriptLinter';
import {SdkDetector} from '@/application/cli/sdkDetector';
import {ConfigurationFileManager} from '@/application/project/configuration/manager/configurationFileManager';
import {AddSlotCommand, AddSlotInput} from '@/application/cli/command/slot/add';
import {SlotForm} from '@/application/cli/form/workspace/slotForm';
import {AddComponentCommand, AddComponentInput} from '@/application/cli/command/component/add';
import {ComponentForm} from '@/application/cli/form/workspace/componentForm';
import {RemoveSlotCommand, RemoveSlotInput} from '@/application/cli/command/slot/remove';
import {RemoveComponentCommand, RemoveComponentInput} from '@/application/cli/command/component/remove';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {NewConfigurationManager} from '@/application/project/configuration/manager/newConfigurationManager';
import {InstallCommand, InstallInput} from '@/application/cli/command/install';
import {PageForm} from '@/application/cli/form/page';
import {NonInteractiveAuthenticator} from '@/application/cli/authentication/authenticator/nonInteractiveAuthenticator';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {NonInteractiveInput} from '@/infrastructure/application/cli/io/nonInteractiveInput';
import {
    MultiAuthenticationInput,
    MultiAuthenticator,
} from '@/application/cli/authentication/authenticator/multiAuthenticator';
import {ApiError} from '@/application/api/error';
import {UpgradeCommand, UpgradeInput} from '@/application/cli/command/upgrade';
import {ConfigurationError} from '@/application/project/configuration/configuration';

export type Configuration = {
    io: {
        input: Readable,
        output: Writable,
    },
    directories: {
        current: string,
        config: string,
    },
    api: {
        graphqlEndpoint: string,
        tokenEndpoint: string,
        tokenParameter: string,
        authenticationEndpoint: string,
        authenticationParameter: string,
    },
    quiet: boolean,
    interactive: boolean,
    exitCallback: ExitCallback,
};

type AuthenticationMethods = {
    credentials: CredentialsInput,
    default: Record<never, never>,
};

type AuthenticationInput = MultiAuthenticationInput<AuthenticationMethods>;

export class Cli {
    private readonly configuration: Configuration;

    private authenticator?: Authenticator<AuthenticationInput>;

    private input?: Input;

    private output?: ConsoleOutput;

    private sdkResolver?: SdkResolver;

    private graphqlClient?: GraphqlClient;

    private userApi?: UserApi;

    private organizationApi?: OrganizationApi;

    private workspaceApi?: WorkspaceApi;

    private applicationApi?: ApplicationApi;

    private authenticationListener?: AuthenticationListener;

    private configurationManager?: ConfigurationManager;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public init(input: InitInput): Promise<void> {
        return this.execute(
            new InitCommand({
                sdkResolver: this.getSdkResolver(),
                configurationManager: this.getConfigurationManager(),
                api: {
                    user: this.getUserApi(),
                    organization: this.getOrganizationApi(),
                    workspace: this.getWorkspaceApi(),
                },
                form: {
                    organization: new OrganizationForm({
                        input: this.getFormInput(),
                        output: this.getOutput(),
                        userApi: this.getUserApi(),
                    }),
                    workspace: new WorkspaceForm({
                        input: this.getFormInput(),
                        output: this.getOutput(),
                        organizationApi: this.getOrganizationApi(),
                    }),
                    application: new ApplicationForm({
                        input: this.getFormInput(),
                        output: this.getOutput(),
                        workspaceApi: this.getWorkspaceApi(),
                    }),
                },
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public install(input: InstallInput): Promise<void> {
        return this.execute(
            new InstallCommand({
                sdkResolver: this.getSdkResolver(),
                configurationManager: this.getConfigurationManager(),
                slotForm: new SlotForm({
                    input: this.getFormInput(),
                    output: this.getOutput(),
                    workspaceApi: this.getWorkspaceApi(),
                }),
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public upgrade(input: UpgradeInput): Promise<void> {
        return this.execute(
            new UpgradeCommand({
                sdkResolver: this.getSdkResolver(),
                configurationManager: this.getConfigurationManager(),
                form: {
                    slotForm: new SlotForm({
                        input: this.getFormInput(),
                        output: this.getOutput(),
                        workspaceApi: this.getWorkspaceApi(),
                    }),
                    componentForm: new ComponentForm({
                        input: this.getFormInput(),
                        output: this.getOutput(),
                        workspaceApi: this.getWorkspaceApi(),
                    }),
                },
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public addSlot(input: AddSlotInput): Promise<void> {
        return this.execute(
            new AddSlotCommand({
                sdkResolver: this.getSdkResolver(),
                configurationManager: this.getConfigurationManager(),
                workspaceApi: this.getWorkspaceApi(),
                slotForm: new SlotForm({
                    input: this.getFormInput(),
                    output: this.getOutput(),
                    workspaceApi: this.getWorkspaceApi(),
                }),
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public removeSlot(input: RemoveSlotInput): Promise<void> {
        return this.execute(
            new RemoveSlotCommand({
                sdkResolver: this.getSdkResolver(),
                configurationManager: this.getConfigurationManager(),
                slotForm: new SlotForm({
                    input: this.getFormInput(),
                    output: this.getOutput(),
                    workspaceApi: this.getWorkspaceApi(),
                }),
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public addComponent(input: AddComponentInput): Promise<void> {
        return this.execute(
            new AddComponentCommand({
                sdkResolver: this.getSdkResolver(),
                configurationManager: this.getConfigurationManager(),
                componentForm: new ComponentForm({
                    input: this.getFormInput(),
                    output: this.getOutput(),
                    workspaceApi: this.getWorkspaceApi(),
                }),
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public removeComponent(input: RemoveComponentInput): Promise<void> {
        return this.execute(
            new RemoveComponentCommand({
                sdkResolver: this.getSdkResolver(),
                configurationManager: this.getConfigurationManager(),
                componentForm: new ComponentForm({
                    input: this.getFormInput(),
                    output: this.getOutput(),
                    workspaceApi: this.getWorkspaceApi(),
                }),
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public login(input: LoginInput<AuthenticationInput>): Promise<void> {
        return this.execute(new LoginCommand({authenticator: this.getAuthenticator()}), input);
    }

    public logout(): Promise<void> {
        return this.execute(
            new LogoutCommand({
                authenticator: this.getAuthenticator(),
                output: this.getOutput(),
            }),
            {},
        );
    }

    public admin(input: AdminInput): Promise<void> {
        return this.execute(
            new AdminCommand({
                output: this.getOutput(),
                pageForm: new PageForm({
                    input: this.getFormInput(),
                }),
                configurationManager: this.getConfigurationManager(),
                userApi: this.getUserApi(),
                endpoint: {
                    url: this.configuration.api.authenticationEndpoint,
                    parameter: this.configuration.api.authenticationParameter,
                },
            }),
            input,
        );
    }

    private getFormInput(): Input {
        return this.getInput() ?? new NonInteractiveInput({
            message: 'Input is not available in non-interactive mode.',
        });
    }

    private getInput(): Input|undefined {
        if (this.input === undefined && this.configuration.interactive) {
            const output = this.getOutput();

            this.input = new ConsoleInput({
                input: this.configuration.io.input,
                output: this.configuration.io.output,
                onAbort: () => output.exit(),
                onInteractionStart: () => output.suspend(),
                onInteractionEnd: () => output.resume(),
            });
        }

        return this.input;
    }

    private getOutput(): ConsoleOutput {
        if (this.output === undefined) {
            this.output = new ConsoleOutput({
                output: this.configuration.io.output,
                interactive: this.configuration.interactive,
                quiet: this.configuration.quiet,
                onExit: this.configuration.exitCallback,
            });
        }

        return this.output;
    }

    private getAuthenticator(): Authenticator<AuthenticationInput> {
        if (this.authenticator === undefined) {
            this.authenticator = new TokenFileAuthenticator({
                filePath: join(this.configuration.directories.config, 'token'),
                authenticator: this.createAuthenticator(),
            });
        }

        return this.authenticator;
    }

    private createAuthenticator(): Authenticator<AuthenticationInput> {
        const input = this.getFormInput();

        const credentialsAuthenticator = new CredentialsAuthenticator({
            input: input,
            output: this.getOutput(),
            userApi: this.getUserApi(true),
            form: {
                signIn: new SignInForm({
                    input: input,
                    output: this.getOutput(),
                    userApi: this.getUserApi(true),
                    listener: this.getAuthenticationListener(),
                }),
                signUp: new SignUpForm({
                    input: input,
                    output: this.getOutput(),
                    userApi: this.getUserApi(true),
                    listener: this.getAuthenticationListener(),
                }),
            },
        });

        return new MultiAuthenticator<AuthenticationMethods>({
            default: this.configuration.interactive
                ? credentialsAuthenticator
                : new NonInteractiveAuthenticator({
                    authenticator: credentialsAuthenticator,
                    instruction: {
                        message: 'Authentication required.',
                        suggestions: ['Run `login` to authenticate'],
                        code: CliErrorCode.PRECONDITION,
                    },
                }),
            credentials: credentialsAuthenticator,
        });
    }

    private getSdkResolver(): SdkResolver {
        if (this.sdkResolver === undefined) {
            this.sdkResolver = new SdkDetector({
                resolvers: this.createJavaScriptSdkResolvers(),
            });
        }

        return this.sdkResolver;
    }

    private createJavaScriptSdkResolvers(): Array<SdkResolver<Sdk|null>> {
        const project = this.createJavaScriptProject();
        const linter = this.createJavaScriptLinter(project);

        return [
            new PlugNextSdk({
                project: project,
                linter: linter,
                api: {
                    user: this.getUserApi(),
                    workspace: this.getWorkspaceApi(),
                    application: this.getApplicationApi(),
                },
                codemod: {
                    middleware: new LintCode(
                        new TransformFile(
                            new ParseCode({
                                languages: ['typescript', 'jsx'],
                                codemod: new ConfigureMiddleware({
                                    import: {
                                        module: '@croct/plug-next/middleware',
                                        middlewareName: 'middleware',
                                        middlewareFactoryName: 'withCroct',
                                        configName: 'config',
                                        matcherName: 'matcher',
                                        matcherLocalName: 'croctMatcher',
                                    },
                                }),
                            }),
                        ),
                        linter,
                    ),
                    appRouterProvider: new LintCode(
                        new TransformFile(
                            new ParseCode({
                                languages: ['typescript', 'jsx'],
                                codemod: new AddWrapper({
                                    fallbackToNamedExports: false,
                                    fallbackCodemod: new CreateLayoutComponent({
                                        provider: {
                                            component: 'CroctProvider',
                                            module: '@croct/plug-next/CroctProvider',
                                        },
                                    }),
                                    wrapper: {
                                        module: '@croct/plug-next/CroctProvider',
                                        component: 'CroctProvider',
                                    },
                                    targets: {
                                        variable: 'children',
                                    },
                                }),
                            }),
                        ),
                        linter,
                    ),
                    pageRouterProvider: new LintCode(
                        new TransformFile(
                            new ParseCode({
                                languages: ['typescript', 'jsx'],
                                codemod: new AddWrapper({
                                    fallbackToNamedExports: false,
                                    fallbackCodemod: new CreateAppComponent({
                                        provider: {
                                            component: 'CroctProvider',
                                            module: '@croct/plug-next/CroctProvider',
                                        },
                                    }),
                                    wrapper: {
                                        module: '@croct/plug-next/CroctProvider',
                                        component: 'CroctProvider',
                                    },
                                    targets: {
                                        component: 'Component',
                                    },
                                }),
                            }),
                        ),
                        linter,
                    ),
                },
            }),
            new PlugReactSdk({
                project: project,
                linter: linter,
                api: {
                    workspace: this.getWorkspaceApi(),
                },
                codemod: {
                    provider: new LintCode(
                        new TransformFile(
                            new ParseCode({
                                languages: ['typescript', 'jsx'],
                                codemod: new AddWrapper({
                                    fallbackToNamedExports: true,
                                    wrapper: {
                                        module: '@croct/plug-react',
                                        component: 'CroctProvider',
                                    },
                                    targets: {
                                        variable: 'children',
                                    },
                                }),
                            }),
                        ),
                        linter,
                    ),
                },
                bundlers: [
                    {
                        package: 'react-scripts',
                        prefix: 'process.env.REACT_APP_',
                    },
                    {
                        package: 'vite',
                        prefix: 'import.meta.env.VITE_',
                    },
                    {
                        package: 'parcel',
                        prefix: 'process.env.',
                    },
                ],
            }),
            new PlugJsSdk({
                project: project,
                linter: linter,
                workspaceApi: this.getWorkspaceApi(),
            }),
        ];
    }

    private createJavaScriptProject(): JavaScriptProject {
        return new NodeProject({
            directory: this.configuration.directories.current,
        });
    }

    private createJavaScriptLinter(project: Project): Linter {
        return new JavaScriptLinter({
            project: project,
            tools: [
                {
                    package: 'eslint',
                    bin: 'eslint',
                    args: files => ['--fix', ...files],
                },
                {
                    package: 'prettier',
                    args: files => ['--write', ...files],
                },
                {
                    package: '@biomejs/biome',
                    bin: 'biome',
                    args: files => ['format', '--write', ...files],
                },
            ],
        });
    }

    private getConfigurationManager(): ConfigurationManager {
        if (this.configurationManager === undefined) {
            const output = this.getOutput();
            const manager = new ConfigurationFileManager({
                file: new JsonFileConfiguration(this.configuration.directories.current),
                output: output,
                api: {
                    user: this.getUserApi(),
                    organization: this.getOrganizationApi(),
                    workspace: this.getWorkspaceApi(),
                },
            });

            this.configurationManager = this.configuration.interactive
                ? new NewConfigurationManager({
                    manager: manager,
                    initializer: {
                        initialize: async (): Promise<void> => {
                            await this.init({});
                            output.break();
                        },
                    },
                })
                : manager;
        }

        return this.configurationManager;
    }

    private getUserApi(optionalAuthentication = false): UserApi {
        if (optionalAuthentication) {
            return new GraphqlUserApi(this.getGraphqlClient(true));
        }

        if (this.userApi === undefined) {
            this.userApi = new GraphqlUserApi(this.getGraphqlClient());
        }

        return this.userApi;
    }

    private getOrganizationApi(): OrganizationApi {
        if (this.organizationApi === undefined) {
            this.organizationApi = new GraphqlOrganizationApi(this.getGraphqlClient());
        }

        return this.organizationApi;
    }

    private getWorkspaceApi(): WorkspaceApi {
        if (this.workspaceApi === undefined) {
            this.workspaceApi = new GraphqlWorkspaceApi(this.getGraphqlClient());
        }

        return this.workspaceApi;
    }

    private getApplicationApi(): ApplicationApi {
        if (this.applicationApi === undefined) {
            this.applicationApi = new GraphqlApplicationApi(this.getGraphqlClient());
        }

        return this.applicationApi;
    }

    private getGraphqlClient(optionalAuthentication = false): GraphqlClient {
        if (optionalAuthentication) {
            return new FetchGraphqlClient({
                endpoint: this.configuration.api.graphqlEndpoint,
                tokenProvider: {
                    getToken: () => this.getAuthenticator().getToken(),
                },
            });
        }

        if (this.graphqlClient === undefined) {
            const authenticator = this.getAuthenticator();

            this.graphqlClient = new FetchGraphqlClient({
                endpoint: this.configuration.api.graphqlEndpoint,
                tokenProvider: {
                    getToken: async () => (await authenticator.getToken())
                        ?? (authenticator.login({method: 'default'})),
                },
            });
        }

        return this.graphqlClient;
    }

    private getAuthenticationListener(): AuthenticationListener {
        if (this.authenticationListener === undefined) {
            this.authenticationListener = new HttpPollingListener({
                endpoint: this.configuration.api.tokenEndpoint,
                parameter: this.configuration.api.tokenParameter,
                pollingInterval: 1000,
            });
        }

        return this.authenticationListener;
    }

    private async execute<I extends CommandInput>(command: Command<I>, input: I): Promise<void> {
        try {
            await command.execute(input);
        } catch (error) {
            const output = this.getOutput();

            output.report(Cli.handleError(error));

            return output.exit();
        }
    }

    private static handleError(error: unknown): any {
        if (error instanceof ApiError && error.isAccessDenied()) {
            return new CliError(
                'Your user lacks the necessary permissions to complete this operation.',
                {
                    code: CliErrorCode.ACCESS_DENIED,
                    suggestions: ['Contact your organization or workspace administrator for assistance.'],
                    cause: error,
                },
            );
        }

        if (error instanceof ConfigurationError) {
            return new CliError(
                error.message,
                {
                    code: CliErrorCode.INVALID_CONFIGURATION,
                    details: error.details,
                    suggestions: ['Run `init` to create a new configuration.'],
                    cause: error,
                },
            );
        }

        return error;
    }
}
