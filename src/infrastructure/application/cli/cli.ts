import {join} from 'path';
import {ConsoleInput} from '@/infrastructure/application/cli/io/consoleInput';
import {ConsoleOutput, ExitCallback} from '@/infrastructure/application/cli/io/consoleOutput';
import {HttpPollingListener} from '@/infrastructure/application/cli/io/httpPollingListener';
import {NodeProject} from '@/infrastructure/project/nodeProject';
import {Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {PlugJsSdk} from '@/application/project/sdk/plugJsSdk';
import {PlugReactSdk} from '@/application/project/sdk/plugReactSdk';
import {PlugNextSdk} from '@/application/project/sdk/plugNextSdk';
import {InitCommand, InitInput} from '@/application/cli/command/init';
import {LoginCommand} from '@/application/cli/command/login';
import {LogoutCommand} from '@/application/cli/command/logout';
import {Input} from '@/application/cli/io/input';
import {JsonFileConfiguration} from '@/infrastructure/project/jsonFileConfiguration';
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
import {ExternalAuthenticator} from '@/application/cli/authentication/authenticator/externalAuthenticator';
import {SignInForm} from '@/application/cli/form/auth/signInForm';
import {AuthenticationListener} from '@/application/cli/authentication/authentication';
import {SignUpForm} from '@/application/cli/form/auth/signUpForm';
import {Command, CommandInput} from '@/application/cli/command/command';
import {AdminCommand} from '@/application/cli/command/admin';
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
import {ProjectConfigurationManager} from '@/application/project/configuration';
import {ConfigurationFileManager} from '@/infrastructure/project/configurationFileManager';
import {AddSlotCommand, AddSlotInput} from '@/application/cli/command/slot/add';
import {SlotForm} from '@/application/cli/form/workspace/slotForm';
import {AddComponentCommand, AddComponentInput} from '@/application/cli/command/component/add';
import {ComponentForm} from '@/application/cli/form/workspace/componentForm';

export type Configuration = {
    io: {
        input: NodeJS.ReadStream,
        output: NodeJS.WriteStream,
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
    exitCallback: ExitCallback,
};

export class Cli {
    private readonly configuration: Configuration;

    private authenticator?: Authenticator;

    private input?: Input;

    private output?: ConsoleOutput;

    private sdkResolver?: SdkResolver;

    private graphqlClient?: GraphqlClient;

    private userApi?: UserApi;

    private organizationApi?: OrganizationApi;

    private workspaceApi?: WorkspaceApi;

    private applicationApi?: ApplicationApi;

    private authenticationListener?: AuthenticationListener;

    private configurationManager?: ProjectConfigurationManager;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public init(input: InitInput): Promise<void> {
        return this.execute(
            new InitCommand({
                sdkResolver: this.getSdkResolver(),
                configurationManager: this.getConfigurationManager(),
                workspaceApi: this.getWorkspaceApi(),
                form: {
                    organization: new OrganizationForm({
                        input: this.getInput(),
                        output: this.getOutput(),
                        userApi: this.getUserApi(),
                    }),
                    workspace: new WorkspaceForm({
                        input: this.getInput(),
                        output: this.getOutput(),
                        organizationApi: this.getOrganizationApi(),
                    }),
                    application: new ApplicationForm({
                        input: this.getInput(),
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
                slotForm: new SlotForm({
                    input: this.getInput(),
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
                    input: this.getInput(),
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

    public login(): Promise<void> {
        return this.execute(new LoginCommand({authenticator: this.getAuthenticator()}), {});
    }

    public logout(): Promise<void> {
        return this.execute(new LogoutCommand({authenticator: this.getAuthenticator()}), {});
    }

    public admin(): Promise<void> {
        return this.execute(
            new AdminCommand({
                output: this.getOutput(),
                userApi: this.getUserApi(),
                endpoint: {
                    url: this.configuration.api.authenticationEndpoint,
                    parameter: this.configuration.api.authenticationParameter,
                },
            }),
            {},
        );
    }

    private getInput(): Input {
        if (this.input === undefined) {
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
                onExit: this.configuration.exitCallback,
            });
        }

        return this.output;
    }

    private getAuthenticator(): Authenticator {
        if (this.authenticator === undefined) {
            this.authenticator = new TokenFileAuthenticator({
                filePath: join(this.configuration.directories.config, 'token'),
                logger: this.getOutput(),
                authenticator: new ExternalAuthenticator({
                    input: this.getInput(),
                    output: this.getOutput(),
                    userApi: this.getUserApi(true),
                    form: {
                        signIn: new SignInForm({
                            input: this.getInput(),
                            output: this.getOutput(),
                            userApi: this.getUserApi(true),
                            listener: this.getAuthenticationListener(),
                        }),
                        signUp: new SignUpForm({
                            input: this.getInput(),
                            output: this.getOutput(),
                            userApi: this.getUserApi(true),
                            listener: this.getAuthenticationListener(),
                        }),
                    },
                }),
            });
        }

        return this.authenticator;
    }

    private getSdkResolver(): SdkResolver {
        if (this.sdkResolver === undefined) {
            this.sdkResolver = new SdkDetector({
                resolvers: this.createJavaScriptSdkResolvers(),
                output: this.getOutput(),
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

    private getConfigurationManager(): ProjectConfigurationManager {
        if (this.configurationManager === undefined) {
            this.configurationManager = new ConfigurationFileManager({
                file: new JsonFileConfiguration(this.configuration.directories.current),
                output: this.getOutput(),
                api: {
                    user: this.getUserApi(),
                    organization: this.getOrganizationApi(),
                    workspace: this.getWorkspaceApi(),
                    application: this.getApplicationApi(),
                },
            });
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
            this.graphqlClient = new FetchGraphqlClient({
                endpoint: this.configuration.api.graphqlEndpoint,
                tokenProvider: {
                    getToken: () => this.getAuthenticator().login(),
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

            output.report(error);

            return output.exit();
        }
    }
}
