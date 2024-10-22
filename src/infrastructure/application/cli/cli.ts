import {join} from 'path';
import {ConsoleInput} from '@/infrastructure/application/cli/io/consoleInput';
import {ConsoleOutput, ExitCallback} from '@/infrastructure/application/cli/io/consoleOutput';
import {HttpPollingListener} from '@/infrastructure/application/cli/io/httpPollingListener';
import {NodeProjectManager} from '@/infrastructure/project/nodeProjectManager';
import {SdkResolver, SequentialSdkResolver} from '@/application/project/sdk/sdk';
import {PlugJsSdk} from '@/application/project/sdk/plugJsSdk';
import {PlugReactSdk} from '@/application/project/sdk/plugReactSdk';
import {PlugNextSdk} from '@/application/project/sdk/plugNextSdk';
import {InitCommand, InitInput, InitOutput} from '@/application/cli/command/init';
import {LoginCommand, LoginOutput} from '@/application/cli/command/login';
import {LogoutCommand, LogoutOutput} from '@/application/cli/command/logout';
import {Input} from '@/application/cli/io/input';
import {JsonFileConfiguration} from '@/infrastructure/project/jsonFileConfiguration';
import {GraphqlClient} from '@/infrastructure/graphql';
import {FetchGraphqlClient} from '@/infrastructure/graphql/fetchGraphqlClient';
import {ProjectManager} from '@/application/project/projectManager';
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
import {ProjectConfigurationFile} from '@/application/project/configuration';
import {AddWrapper} from '@/application/project/sdk/code/jsx/addWrapper';
import {ParseCode} from '@/application/project/sdk/code/parseCode';
import {ConfigureMiddleware} from '@/application/project/sdk/code/nextjs/configureMiddleware';
import {Linter} from '@/application/project/linter';
import {LintCode} from '@/application/project/sdk/code/lintCode';
import {TransformFile} from '@/application/project/sdk/code/transformFile';
import {CreateLayoutComponent} from '@/application/project/sdk/code/nextjs/createLayoutComponent';
import {CreateAppComponent} from '@/application/project/sdk/code/nextjs/createAppComponent';
import {NodeLinter} from '@/infrastructure/project/nodeLinter';
import {AlternativelyApply} from '@/application/project/sdk/code/alternativelyApply';

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

    private projectManager?: ProjectManager;

    private linter?: Linter;

    private graphqlClient?: GraphqlClient;

    private userApi?: UserApi;

    private organizationApi?: OrganizationApi;

    private workspaceApi?: WorkspaceApi;

    private applicationApi?: ApplicationApi;

    private authenticationListener?: AuthenticationListener;

    private configurationFile?: ProjectConfigurationFile;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public init(input: InitInput): Promise<InitOutput> {
        return this.execute(
            new InitCommand({
                sdkResolver: this.getSdkResolver(),
                configurationFile: this.getConfigurationFile(),
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

    public login(): Promise<LoginOutput> {
        return this.execute(new LoginCommand({authenticator: this.getAuthenticator()}), {});
    }

    public logout(): Promise<LogoutOutput> {
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
            this.sdkResolver = new SequentialSdkResolver([
                new PlugNextSdk({
                    projectManager: this.getProjectManager(),
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
                                            middlewareFunctionName: 'middleware',
                                            highOrderFunctionName: 'withCroct',
                                            configName: 'config',
                                            matcherName: 'matcher',
                                            matcherLocalName: 'croctMatcher',
                                        },
                                    }),
                                }),
                            ),
                            this.getLinter(),
                        ),
                        appRouterProvider: new LintCode(
                            new TransformFile(
                                new ParseCode({
                                    languages: ['typescript', 'jsx'],
                                    codemod: new AlternativelyApply(
                                        new AddWrapper({
                                            namedExportFallback: false,
                                            wrapper: {
                                                module: '@croct/plug-next/CroctProvider',
                                                component: 'CroctProvider',
                                            },
                                            targets: {
                                                variable: 'children',
                                            },
                                        }),
                                        new CreateLayoutComponent(),
                                    ),
                                }),
                            ),
                            this.getLinter(),
                        ),
                        pageRouterProvider: new LintCode(
                            new TransformFile(
                                new ParseCode({
                                    languages: ['typescript', 'jsx'],
                                    codemod: new AlternativelyApply(
                                        new AddWrapper({
                                            namedExportFallback: false,
                                            wrapper: {
                                                module: '@croct/plug-next/CroctProvider',
                                                component: 'CroctProvider',
                                            },
                                            targets: {
                                                component: 'Component',
                                            },
                                        }),
                                        new CreateAppComponent(),
                                    ),
                                }),
                            ),
                            this.getLinter(),
                        ),
                    },
                }),
                new PlugReactSdk(this.getProjectManager()),
                new PlugJsSdk(this.getProjectManager()),
            ]);
        }

        return this.sdkResolver;
    }

    private getProjectManager(): ProjectManager {
        if (this.projectManager === undefined) {
            this.projectManager = new NodeProjectManager({
                directory: this.configuration.directories.current,
            });
        }

        return this.projectManager;
    }

    private getLinter(): Linter {
        if (this.linter === undefined) {
            this.linter = new NodeLinter({
                projectManager: this.getProjectManager(),
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

        return this.linter;
    }

    private getConfigurationFile(): ProjectConfigurationFile {
        if (this.configurationFile === undefined) {
            this.configurationFile = new JsonFileConfiguration(this.configuration.directories.current);
        }

        return this.configurationFile;
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

    private async execute<I extends CommandInput, O>(command: Command<I, O>, input: I): Promise<O> {
        try {
            return await command.execute(input);
        } catch (error) {
            const output = this.getOutput();

            output.report(error);

            return output.exit();
        }
    }
}
