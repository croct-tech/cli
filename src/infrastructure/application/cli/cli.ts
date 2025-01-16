import {Readable, Writable} from 'stream';
import * as process from 'node:process';
import {ConsoleInput} from '@/infrastructure/application/cli/io/consoleInput';
import {ConsoleOutput, ExitCallback} from '@/infrastructure/application/cli/io/consoleOutput';
import {HttpPollingListener} from '@/infrastructure/application/cli/io/httpPollingListener';
import {NodeProjectManager} from '@/application/project/manager/nodeProjectManager';
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
import {ProjectManager} from '@/application/project/manager/projectManager';
import {UserApi} from '@/application/api/user';
import {OrganizationApi} from '@/application/api/organization';
import {WorkspaceApi} from '@/application/api/workspace';
import {GraphqlUserApi} from '@/infrastructure/application/api/graphql/user';
import {GraphqlOrganizationApi} from '@/infrastructure/application/api/graphql/organization';
import {GraphqlWorkspaceApi} from '@/infrastructure/application/api/graphql/workspace';
import {OrganizationForm} from '@/application/cli/form/organization/organizationForm';
import {WorkspaceForm} from '@/application/cli/form/workspace/workspaceForm';
import {ApplicationForm} from '@/application/cli/form/application/applicationForm';
import {ApplicationApi} from '@/application/api/application';
import {GraphqlApplicationApi} from '@/infrastructure/application/api/graphql/application';
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
import {Instruction, NonInteractiveInput} from '@/infrastructure/application/cli/io/nonInteractiveInput';
import {
    MultiAuthenticationInput,
    MultiAuthenticator,
} from '@/application/cli/authentication/authenticator/multiAuthenticator';
import {ApiError} from '@/application/api/error';
import {UpgradeCommand, UpgradeInput} from '@/application/cli/command/upgrade';
import {ConfigurationError} from '@/application/project/configuration/configuration';
import {FileSystem} from '@/application/fs/fileSystem';
import {LocalFilesystem} from '@/application/fs/localFilesystem';
import {ImportConfigLoader} from '@/application/project/manager/importConfigLoader';
import {JavaScriptProjectManager} from '@/application/project/manager/javaScriptProjectManager';
import {AntfuPackageInstaller} from '@/infrastructure/project/antfuPackageInstaller';
import {FocusListener} from '@/infrastructure/application/cli/io/focusListener';
import {EmailLinkGenerator} from '@/application/cli/email/email';
import {FallbackProviderDetector} from '@/application/cli/email/detector/fallbackProviderDetector';
import {DomainProviderDetector} from '@/application/cli/email/detector/domainProviderDetector';
import {DnsProviderDetector} from '@/application/cli/email/detector/dnsProviderDetector';
import {GoogleTemplate} from '@/application/cli/email/template/googleTemplate';
import {ICloudTemplate} from '@/application/cli/email/template/icloudTemplate';
import {MicrosoftTemplate} from '@/application/cli/email/template/microsoftTemplate';
import {ProtonTemplate} from '@/application/cli/email/template/protonTemplate';
import {YahooTemplate} from '@/application/cli/email/template/yahooTemplate';
import {CreateTemplateCommand, CreateTemplateInput} from '@/application/cli/command/template/create';
import {TemplateForm} from '@/application/cli/form/workspace/templateForm';
import {ExperienceForm} from '@/application/cli/form/workspace/experienceForm';
import {AudienceForm} from '@/application/cli/form/workspace/audienceForm';
import {ImportTemplateCommand, ImportTemplateInput, LoadedTemplate} from '@/application/cli/command/template/import';
import {Download} from '@/application/template/action/download';
import {ActionRunner} from '@/application/template/action/runner';
import {ResolveImportFile} from '@/application/template/action/resolveImport';
import {AddDependency} from '@/application/template/action/addDependency';
import {LocateFile} from '@/application/template/action/locateFile';
import {ReplaceFileContent} from '@/application/template/action/replaceFileContent';
import {OptionMap, Template} from '@/application/template/template';
import {AddSlot} from '@/application/template/action/addSlot';
import {AddComponent} from '@/application/template/action/addComponent';
import {Try} from '@/application/template/action/try';
import {ActionMap} from '@/application/template/action/action';
import {LazyAction} from '@/application/template/action/lazyAction';
import {CachedConfigurationManager} from '@/application/project/configuration/manager/cachedConfigurationManager';
import {ConfigurationFileManager} from '@/application/project/configuration/manager/configurationFileManager';
import {CachedSdkResolver} from '@/application/project/sdk/cachedSdkResolver';
import {CreateResource} from '@/application/template/action/createResource';
import {SlugMappingForm} from '@/application/cli/form/workspace/slugMappingForm';
import {ResourceMatcher} from '@/application/template/resourceMatcher';
import {FetchTransport} from '@/application/template/transport/fetchTransport';
import {CheckDependencies} from '@/application/template/action/checkDependencies';
import {HttpTransport} from '@/application/template/transport/httpTransport';
import {MappedTransport} from '@/application/template/transport/mappedTransport';
import {MultiTransport} from '@/application/template/transport/multiTransport';
import {FileSystemTransport} from '@/application/template/transport/fileSystemTransport';
import {TemplateTransport} from '@/application/template/transport/templateTransport';
import {GithubTransport} from '@/application/template/transport/githubTransport';
import {HttpFileTransport} from '@/application/template/transport/httpFileTransport';
import {Transport} from '@/application/template/transport/transport';
import {AdaptedTransport} from '@/application/template/transport/adaptedTransport';

export type Configuration = {
    io: {
        input: Readable,
        output: Writable,
    },
    directories: {
        current: string,
        config: string,
        downloadCache: string,
    },
    api: {
        graphqlEndpoint: string,
        tokenEndpoint: string,
        tokenParameter: string,
        authenticationEndpoint: string,
        authenticationParameter: string,
    },
    cache: boolean,
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

    private fileSystem: FileSystem;

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

    private emailLinkGenerator?: EmailLinkGenerator;

    private transport: HttpTransport;

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

    public createTemplate(input: CreateTemplateInput): Promise<void> {
        return this.execute(
            new CreateTemplateCommand({
                configurationManager: this.getConfigurationManager(),
                fileSystem: this.getFileSystem(),
                templateForm: new TemplateForm({
                    input: this.getFormInput(),
                    form: {
                        component: new ComponentForm({
                            input: this.getFormInput(),
                            output: this.getOutput(),
                            workspaceApi: this.getWorkspaceApi(),
                        }),
                        slot: new SlotForm({
                            input: this.getFormInput(),
                            output: this.getOutput(),
                            workspaceApi: this.getWorkspaceApi(),
                        }),
                        experience: new ExperienceForm({
                            input: this.getFormInput(),
                            output: this.getOutput(),
                            workspaceApi: this.getWorkspaceApi(),
                        }),
                        audience: new AudienceForm({
                            input: this.getFormInput(),
                            output: this.getOutput(),
                            workspaceApi: this.getWorkspaceApi(),
                        }),
                    },
                }),
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public importTemplate(input: ImportTemplateInput): Promise<void> {
        const command = this.getImportTemplateCommand();

        return this.execute(command, input);
    }

    public async getTemplateOptions(template: string): Promise<OptionMap> {
        const command = this.getImportTemplateCommand();
        const output = this.getOutput();

        const notifier = output.notify('Loading template...');

        try {
            return await command.getOptions(template);
        } finally {
            notifier.stop();
        }
    }

    private getImportTemplateCommand(): ImportTemplateCommand {
        return new ImportTemplateCommand({
            transport: this.getTemplateTransport(),
            fileSystem: this.getFileSystem(),
            actionRunner: this.getActionRunner(),
            configurationManager: this.getConfigurationManager(),
            sdkResolver: this.getSdkResolver(),
            io: {
                input: this.getInput(),
                output: this.getOutput(),
            },
        });
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

    private getFormInput(instruction?: Instruction): Input {
        return this.getInput() ?? this.getNonInteractiveInput(instruction);
    }

    private getNonInteractiveInput(instruction?: Instruction): Input {
        return new NonInteractiveInput(instruction ?? {
            message: 'Input is not available in non-interactive mode.',
        });
    }

    private getInput(): Input | undefined {
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

    private getNonInteractiveOutput(quiet = false): ConsoleOutput {
        return new ConsoleOutput({
            output: this.configuration.io.output,
            interactive: false,
            quiet: quiet,
            onExit: this.configuration.exitCallback,
        });
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

    private getTemplateTransport(): Transport<LoadedTemplate> {
        const httpTransport = this.getHttpTransport();

        return new MappedTransport({
            transport: new MappedTransport({
                transport: new AdaptedTransport({
                    transport: new TemplateTransport(
                        new MultiTransport(
                            new FileSystemTransport(this.getFileSystem()),
                            new GithubTransport(httpTransport),
                            new HttpFileTransport(httpTransport),
                        ),
                    ),
                    adapter: (template: Template, url: URL): Promise<LoadedTemplate> => Promise.resolve({
                        template: template,
                        url: url,
                    }),
                }),
                mapping: [
                    {
                        // Any URL not ending with a file extension, excluding the trailing slash
                        pattern: /^(.+?:\/+[^/]+(\/+[^/.]+|\/[^/]+(?=\/))*)\/*$/,
                        template: '$1/template.json',
                    },
                ],
            }),
            mapping: [
                // @todo load from external registry
                {
                    pattern: /^croct:\/(.+?)$/,
                    template: 'github:/marcospassos/croct-examples/$1',
                },
                {
                    pattern: /^https:\/\/magicui.design\/r\/(.+?)$/,
                    template: 'github:/marcospassos/croct-examples/magic-ui/ui/$1',
                },
            ],
        });
    }

    private getActionRunner(): ActionRunner {
        const fileSystem = this.getFileSystem();
        const projectManager = this.createJavaScriptProjectManager();
        const httpTransport = this.getHttpTransport();

        const actions: ActionMap = {
            try: new LazyAction(() => new Try(actions)),
            'check-dependencies': new CheckDependencies({
                projectManager: projectManager,
            }),
            download: new Download({
                fileSystem: fileSystem,
                transport: new MultiTransport(
                    new FileSystemTransport(this.getFileSystem()),
                    new GithubTransport(httpTransport),
                    new HttpFileTransport(httpTransport),
                ),
            }),
            'resolve-import': new ResolveImportFile({
                importResolver: (target, source) => projectManager.getImportPath(target, source),
            }),
            'add-dependency': new AddDependency({
                installer: (dependencies, development) => projectManager.installPackage(dependencies, {
                    dev: development,
                }),
            }),
            'locate-file': new LocateFile({
                fileSystem: fileSystem,
            }),
            'replace-file-content': new ReplaceFileContent({
                fileSystem: fileSystem,
            }),
            'add-slot': new AddSlot({
                installer: (slots, example): Promise<void> => {
                    const output = this.getNonInteractiveOutput(true);

                    return this.execute(
                        new AddSlotCommand({
                            sdkResolver: this.getSdkResolver(),
                            configurationManager: this.getConfigurationManager(),
                            workspaceApi: this.getWorkspaceApi(),
                            slotForm: new SlotForm({
                                input: this.getNonInteractiveInput(),
                                output: output,
                                workspaceApi: this.getWorkspaceApi(),
                            }),
                            io: {
                                output: output,
                            },
                        }),
                        {
                            slots: slots,
                            example: example,
                        },
                    );
                },
            }),
            'add-component': new AddComponent({
                installer: (components): Promise<void> => {
                    const output = this.getNonInteractiveOutput(true);

                    return this.execute(
                        new AddComponentCommand({
                            sdkResolver: this.getSdkResolver(),
                            configurationManager: this.getConfigurationManager(),
                            componentForm: new ComponentForm({
                                input: this.getNonInteractiveInput(),
                                output: output,
                                workspaceApi: this.getWorkspaceApi(),
                            }),
                            io: {
                                output: output,
                            },
                        }),
                        {
                            components: components,
                        },
                    );
                },
            }),
            'create-resource': new CreateResource({
                configurationManager: this.getConfigurationManager(),
                matcher: new ResourceMatcher({
                    workspaceApi: this.getWorkspaceApi(),
                }),
                api: {
                    user: this.getUserApi(),
                    workspace: this.getWorkspaceApi(),
                    organization: this.getOrganizationApi(),
                },
                mappingForm: new SlugMappingForm({
                    input: this.getFormInput({
                        message: 'Some resource IDs are in use and interactive mode is required to assign new ones.',
                        suggestions: ['Retry in interactive mode'],
                    }),
                    workspaceApi: this.getWorkspaceApi(),
                }),
            }),
        };

        return new ActionRunner(actions);
    }

    private getHttpTransport(): HttpTransport {
        if (this.transport === undefined) {
            this.transport = new FetchTransport();
        }

        return this.transport;
    }

    private getAuthenticator(): Authenticator<AuthenticationInput> {
        if (this.authenticator === undefined) {
            const fileSystem = this.getFileSystem();

            this.authenticator = new TokenFileAuthenticator({
                fileSystem: fileSystem,
                filePath: fileSystem.joinPaths(this.configuration.directories.config, 'token'),
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
                    emailLinkGenerator: {
                        recovery: this.createEmailLinkGenerator('Forgot password'),
                        verification: this.createEmailLinkGenerator('Welcome to Croct'),
                    },
                }),
                signUp: new SignUpForm({
                    input: input,
                    output: this.getOutput(),
                    userApi: this.getUserApi(true),
                    listener: this.getAuthenticationListener(),
                    emailLinkGenerator: this.createEmailLinkGenerator('Welcome to Croct'),
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
            this.sdkResolver = new CachedSdkResolver(
                new SdkDetector({
                    resolvers: this.createJavaScriptSdkResolvers(),
                }),
            );
        }

        return this.sdkResolver;
    }

    private createJavaScriptSdkResolvers(): Array<SdkResolver<Sdk | null>> {
        const projectManager = this.createJavaScriptProjectManager();
        const linter = this.createJavaScriptLinter(projectManager);

        return [
            new PlugNextSdk({
                projectManager: projectManager,
                fileSystem: this.getFileSystem(),
                linter: linter,
                api: {
                    user: this.getUserApi(),
                    workspace: this.getWorkspaceApi(),
                    application: this.getApplicationApi(),
                },
                codemod: {
                    middleware: new LintCode(
                        new TransformFile(
                            this.getFileSystem(),
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
                            this.getFileSystem(),
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
                            this.getFileSystem(),
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
                projectManager: projectManager,
                fileSystem: this.getFileSystem(),
                linter: linter,
                api: {
                    workspace: this.getWorkspaceApi(),
                },
                codemod: {
                    provider: new LintCode(
                        new TransformFile(
                            this.getFileSystem(),
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
                projectManager: projectManager,
                fileSystem: this.getFileSystem(),
                linter: linter,
                workspaceApi: this.getWorkspaceApi(),
            }),
        ];
    }

    private createJavaScriptProjectManager(): JavaScriptProjectManager {
        return new NodeProjectManager({
            fileSystem: this.getFileSystem(),
            packageInstaller: new AntfuPackageInstaller(this.configuration.directories.current),
            importConfigLoader: new ImportConfigLoader(this.getFileSystem()),
            directory: this.configuration.directories.current,
        });
    }

    private createJavaScriptLinter(projectManager: ProjectManager): Linter {
        return new JavaScriptLinter({
            projectManager: projectManager,
            fileSystem: this.getFileSystem(),
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
                file: new JsonFileConfiguration(
                    this.getFileSystem(),
                    this.configuration.directories.current,
                ),
                output: output,
                api: {
                    user: this.getUserApi(),
                    organization: this.getOrganizationApi(),
                    workspace: this.getWorkspaceApi(),
                },
            });

            this.configurationManager = new CachedConfigurationManager(
                this.configuration.interactive
                    ? new NewConfigurationManager({
                        manager: manager,
                        initializer: {
                            initialize: async (): Promise<void> => {
                                await this.init({});
                                output.break();
                            },
                        },
                    })
                    : manager,
            );
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
            this.authenticationListener = new FocusListener(
                new HttpPollingListener({
                    endpoint: this.configuration.api.tokenEndpoint,
                    parameter: this.configuration.api.tokenParameter,
                    pollingInterval: 1000,
                }),
                process.platform,
            );
        }

        return this.authenticationListener;
    }

    private getFileSystem(): FileSystem {
        if (this.fileSystem === undefined) {
            this.fileSystem = new LocalFilesystem({
                currentDirectory: this.configuration.directories.current,
                defaultEncoding: 'utf-8',
            });
        }

        return this.fileSystem;
    }

    private createEmailLinkGenerator(subject?: string): (email: string) => Promise<URL | null> {
        const generator = this.getEmailLinkGenerator();

        return email => generator.generate({
            recipient: email,
            sender: 'croct.com',
            subject: subject,
            timestamp: Math.trunc(Date.now() / 1000),
        });
    }

    private getEmailLinkGenerator(): EmailLinkGenerator {
        if (this.emailLinkGenerator === undefined) {
            this.emailLinkGenerator = new EmailLinkGenerator({
                detector: new FallbackProviderDetector(
                    new DomainProviderDetector(),
                    new DnsProviderDetector(),
                ),
                templates: {
                    google: new GoogleTemplate(),
                    icloud: new ICloudTemplate(),
                    microsoft: new MicrosoftTemplate(),
                    proton: new ProtonTemplate(),
                    yahoo: new YahooTemplate(),
                },
            });
        }

        return this.emailLinkGenerator;
    }

    private async execute<I extends CommandInput>(command: Command<I>, input: I): Promise<void> {
        try {
            await command.execute(input);
        } catch (error) {
            const output = this.getOutput();

            const formattedError = Cli.handleError(error);

            if (error instanceof Error && formattedError instanceof Error) {
                formattedError.stack = error.stack;
            }

            output.report(formattedError);

            return output.exit();
        }
    }

    private static handleError(error: unknown): any {
        if (error instanceof ApiError) {
            if (error.isAccessDenied()) {
                return new CliError(
                    'Your user lacks the necessary permissions to complete this operation.',
                    {
                        code: CliErrorCode.ACCESS_DENIED,
                        details: error.details.map(detail => detail.detail),
                        suggestions: ['Contact your organization or workspace administrator for assistance.'],
                        cause: error,
                    },
                );
            }

            return new CliError(error.message, {
                code: CliErrorCode.OTHER,
                details: error.details.map(detail => detail.detail),
                cause: error,
            });
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
