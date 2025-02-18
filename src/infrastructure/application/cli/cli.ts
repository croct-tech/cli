import {
    AdaptedCache,
    AutoSaveCache,
    CacheProvider,
    InMemoryCache,
    NoopCache,
    PrefixedCache,
    StaleWhileRevalidateCache,
    TimestampedCacheEntry,
} from '@croct/cache';
import {ApiKey} from '@croct/sdk/apiKey';
import {Clock, Instant} from '@croct/time';
import {SystemClock} from '@croct/time/clock/systemClock';
import {ConsoleInput} from '@/infrastructure/application/cli/io/consoleInput';
import {ConsoleOutput} from '@/infrastructure/application/cli/io/consoleOutput';
import {HttpPollingListener} from '@/infrastructure/application/cli/io/httpPollingListener';
import {Sdk} from '@/application/project/sdk/sdk';
import {Configuration as JavaScriptSdkConfiguration} from '@/application/project/sdk/javasScriptSdk';
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
import {
    CredentialsAuthenticator,
    CredentialsInput,
} from '@/application/cli/authentication/authenticator/credentialsAuthenticator';
import {SignInForm} from '@/application/cli/form/user/signInForm';
import {AuthenticationListener} from '@/application/cli/authentication/authentication';
import {SignUpForm} from '@/application/cli/form/user/signUpForm';
import {Command, CommandInput} from '@/application/cli/command/command';
import {AdminCommand, AdminInput} from '@/application/cli/command/admin';
import {AddWrapper} from '@/application/project/code/codemod/jsx/addWrapper';
import {ParseCode} from '@/application/project/code/codemod/parseCode';
import {ConfigureMiddleware} from '@/application/project/code/codemod/nextjs/configureMiddleware';
import {CodeFormatter} from '@/application/project/code/formatter/formatter';
import {FormatCode} from '@/application/project/code/codemod/formatCode';
import {TransformFile} from '@/application/project/code/codemod/transformFile';
import {CreateLayoutComponent} from '@/application/project/code/codemod/nextjs/createLayoutComponent';
import {CreateAppComponent} from '@/application/project/code/codemod/nextjs/createAppComponent';
import {JavaScriptFormatter} from '@/infrastructure/application/project/javaScriptFormatter';
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
import {Instruction, NonInteractiveInput} from '@/infrastructure/application/cli/io/nonInteractiveInput';
import {
    MultiAuthenticationInput,
    MultiAuthenticator,
} from '@/application/cli/authentication/authenticator/multiAuthenticator';
import {ApiError} from '@/application/api/error';
import {UpgradeCommand, UpgradeInput} from '@/application/cli/command/upgrade';
import {ConfigurationError} from '@/application/project/configuration/projectConfiguration';
import {FileSystem, FileSystemIterator} from '@/application/fs/fileSystem';
import {LocalFilesystem} from '@/application/fs/localFilesystem';
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
import {ImportTemplateCommand, ImportTemplateInput} from '@/application/cli/command/template/import';
import {DownloadAction} from '@/application/template/action/downloadAction';
import {ResolveImportAction} from '@/application/template/action/resolveImportAction';
import {AddDependencyAction} from '@/application/template/action/addDependencyAction';
import {LocateFileAction, PathMatcher} from '@/application/template/action/locateFileAction';
import {ReplaceFileContentAction} from '@/application/template/action/replaceFileContentAction';
import {OptionMap} from '@/application/template/template';
import {AddSlotAction} from '@/application/template/action/addSlotAction';
import {AddComponentAction} from '@/application/template/action/addComponentAction';
import {TryAction, TryOptions} from '@/application/template/action/tryAction';
import {LazyAction} from '@/application/template/action/lazyAction';
import {CachedConfigurationManager} from '@/application/project/configuration/manager/cachedConfigurationManager';
import {ConfigurationFileManager} from '@/application/project/configuration/manager/configurationFileManager';
import {CreateResourceAction} from '@/application/template/action/createResourceAction';
import {SlugMappingForm} from '@/application/cli/form/workspace/slugMappingForm';
import {ResourceMatcher} from '@/application/template/resourceMatcher';
import {FetchProvider} from '@/application/template/provider/fetchProvider';
import {CheckDependencyAction} from '@/application/template/action/checkDependencyAction';
import {HttpProvider} from '@/application/template/provider/httpProvider';
import {MappedProvider} from '@/application/template/provider/mappedProvider';
import {MultiProvider} from '@/application/template/provider/multiProvider';
import {FileSystemProvider} from '@/application/template/provider/fileSystemProvider';
import {GithubProvider} from '@/application/template/provider/githubProvider';
import {HttpFileProvider} from '@/application/template/provider/httpFileProvider';
import {ResourceProvider} from '@/application/provider/resourceProvider';
import {ErrorReason, HelpfulError} from '@/application/error';
import {PartialNpmPackageValidator} from '@/infrastructure/application/validation/partialNpmPackageValidator';
import {CroctConfigurationValidator} from '@/infrastructure/application/validation/croctConfigurationValidator';
import {ValidatedProvider} from '@/application/template/provider/validatedProvider';
import {FileContentProvider} from '@/application/template/provider/fileContentProvider';
import {JsonProvider} from '@/application/template/provider/jsonProvider';
import {RegistryValidator} from '@/infrastructure/application/validation/registryValidator';
import {FileSystemCache} from '@/infrastructure/cache/fileSystemCache';
import {CachedProvider} from '@/application/template/provider/cachedProvider';
import {JsepExpressionEvaluator} from '@/infrastructure/application/evaluation/jsepExpressionEvaluator';
import {TemplateValidator} from '@/infrastructure/application/validation/templateValidator';
import {ImportAction, ImportOptions} from '@/application/template/action/importAction';
import {Action} from '@/application/template/action/action';
import {ValidatedAction} from '@/application/template/action/validatedAction';
import {TryOptionsValidator} from '@/infrastructure/application/validation/actions/tryOptionsValidator';
import {
    CheckDependenciesOptionsValidator,
} from '@/infrastructure/application/validation/actions/checkDependenciesOptionsValidator';
import {DownloadOptionsValidator} from '@/infrastructure/application/validation/actions/downloadOptionsValidator';
import {
    ResolveImportOptionsValidator,
} from '@/infrastructure/application/validation/actions/resolveImportOptionsValidator';
import {
    AddDependencyOptionsValidator,
} from '@/infrastructure/application/validation/actions/addDependencyOptionsValidator';
import {LocateFileOptionsValidator} from '@/infrastructure/application/validation/actions/locateFileOptionsValidator';
import {
    ReplaceFileContentOptionsValidator,
} from '@/infrastructure/application/validation/actions/replaceFileContentOptionsValidator';
import {AddSlotOptionsValidator} from '@/infrastructure/application/validation/actions/addSlotOptionsValidator';
import {
    AddComponentOptionsValidator,
} from '@/infrastructure/application/validation/actions/addComponentOptionsValidator';
import {
    CreateResourceOptionsValidator,
} from '@/infrastructure/application/validation/actions/createResourceOptionsValidator';
import {ImportOptionsValidator} from '@/infrastructure/application/validation/actions/importOptionsValidator';
import {TemplateProvider} from '@/application/template/provider/templateProvider';
import {FormatCodeAction} from '@/application/template/action/formatCodeAction';
import {FormatCodeOptionsValidator} from '@/infrastructure/application/validation/actions/formatCodeOptionsValidator';
import {EnumeratedProvider} from '@/application/provider/enumeratedProvider';
import {TestAction, TestOptions} from '@/application/template/action/testAction';
import {TestOptionsValidator} from '@/infrastructure/application/validation/actions/testOptionsValidator';
import {PrintAction} from '@/application/template/action/printAction';
import {PrintOptionsValidator} from '@/infrastructure/application/validation/actions/printOptionsValidator';
import {FailAction} from '@/application/template/action/failAction';
import {FailOptionsValidator} from '@/infrastructure/application/validation/actions/failOptionsValidator';
import {SpecificResourceProvider} from '@/application/provider/specificResourceProvider';
import {ConstantProvider} from '@/application/provider/constantProvider';
import {Server} from '@/application/project/server/server';
import {ProjectServerProvider, ServerFactory} from '@/application/project/server/provider/projectServerProvider';
import {NextCommandParser} from '@/application/project/server/provider/parser/nextCommandParser';
import {ViteCommandParser} from '@/application/project/server/provider/parser/viteCommandParser';
import {ParcelCommandParser} from '@/application/project/server/provider/parser/parcelCommandParser';
import {ReactScriptCommandParser} from '@/application/project/server/provider/parser/reactScriptCommandParser';
import {PromptAction} from '@/application/template/action/promptAction';
import {PromptOptionsValidator} from '@/infrastructure/application/validation/actions/promptOptionsValidator';
import {StartServer} from '@/application/template/action/startServerAction';
import {StartServerOptionsValidator} from '@/infrastructure/application/validation/actions/startServerOptionsValidator';
import {RunAction, RunOptions} from '@/application/template/action/runAction';
import {RunOptionsValidator} from '@/infrastructure/application/validation/actions/runOptionsValidator';
import {OpenLinkAction} from '@/application/template/action/openLinkAction';
import {OpenLinkOptionsValidator} from '@/infrastructure/application/validation/actions/openLinkOptionsValidator';
import {DefineOptionsValidator} from '@/infrastructure/application/validation/actions/defineOptionsValidator';
import {DefineAction} from '@/application/template/action/defineAction';
import {VariableMap} from '@/application/template/evaluation';
import {StopServer} from '@/application/template/action/stopServerAction';
import {StopServerOptionsValidator} from '@/infrastructure/application/validation/actions/stopServerOptionsValidator';
import {ProcessServerFactory} from '@/application/project/server/factory/processServerFactory';
import {ResourceValueProvider} from '@/application/provider/resourceValueProvider';
import {CurrentWorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {
    ChangeDirectoryOptionsValidator,
} from '@/infrastructure/application/validation/actions/changeDirectoryOptionsValidator';
import {ChangeDirectoryAction} from '@/application/template/action/changeDirectoryAction';
import {ExecutePackage} from '@/application/template/action/executePackage';
import {
    ExecutePackageOptionsValidator,
} from '@/infrastructure/application/validation/actions/executePackageOptionsValidator';
import {
    Configuration as NodePackageManagerConfiguration,
    NodePackageManager,
} from '@/application/project/packageManager/nodePackageManager';
import {NpmAgent} from '@/application/project/packageManager/agent/npmAgent';
import {YarnAgent} from '@/application/project/packageManager/agent/yarnAgent';
import {BunAgent} from '@/application/project/packageManager/agent/bunAgent';
import {PnpmAgent} from '@/application/project/packageManager/agent/pnpmAgent';
import {
    Configuration as ExecutableAgentConfiguration,
} from '@/application/project/packageManager/agent/executableAgent';
import {PtyExecutor} from '@/infrastructure/application/command/ptyExecutor';
import {PackageManager} from '@/application/project/packageManager/packageManager';
import {TsConfigLoader} from '@/application/project/import/tsConfigLoader';
import {NodeImportResolver} from '@/application/project/import/nodeImportResolver';
import {PartialTsconfigValidator} from '@/infrastructure/application/validation/partialTsconfigValidator';
import {LazyPackageManager} from '@/application/project/packageManager/lazyPackageManager';
import {EntryProvider} from '@/application/provider/entryProvider';
import {MapProvider} from '@/application/provider/mapProvider';
import {NoopAgent} from '@/application/project/packageManager/agent/noopAgent';
import {Provider, ProviderError} from '@/application/provider/provider';
import {FallbackProvider} from '@/application/provider/fallbackProvider';
import {CallbackProvider} from '@/application/provider/callbackProvider';
import {ConditionalProvider} from '@/application/provider/conditionalProvider';
import {FileExists} from '@/application/predicate/fileExists';
import {HasDependency} from '@/application/predicate/hasDependency';
import {IsProject} from '@/application/predicate/isProject';
import {ImportResolver} from '@/application/project/import/importResolver';
import {LazyImportResolver} from '@/application/project/import/lazyImportResolver';
import {CommandExecutor, SynchronousCommandExecutor} from '@/application/system/process/executor';
import {SpawnExecutor} from '@/infrastructure/application/command/spawnExecutor';
import {LazyFormatter} from '@/application/project/code/formatter/lazyFormatter';
import {LazySdk} from '@/application/project/sdk/lazySdk';
import {MemoizedProvider} from '@/application/provider/memoizedProvider';
import {CachedServerFactory} from '@/application/project/server/factory/cachedServerFactory';
import {MatchesGlob} from '@/application/predicate/matchesGlob';
import {And} from '@/application/predicate/and';
import {Not} from '@/application/predicate/not';
import {MatchesGitignore} from '@/application/predicate/matchesGitignore';
import {LazyPromise} from '@/infrastructure/promise';
import {PredicateProvider} from '@/application/provider/predicateProvider';
import {DefaultChoiceInput} from '@/infrastructure/application/cli/io/defaultChoiceInput';
import {Or} from '@/application/predicate/or';
import * as functions from '@/infrastructure/application/evaluation/functions';
import {Platform} from '@/application/model/platform';
import {RepeatAction} from '@/application/template/action/repeatAction';
import {RepeatOptionsValidator} from '@/infrastructure/application/validation/actions/repeatOptionsValidator';
import {ProtocolRegistry} from '@/application/system/protocol/protocolRegistry';
import {MacOsRegistry} from '@/application/system/protocol/macOsRegistry';
import {WindowsRegistry} from '@/application/system/protocol/windowsRegistry';
import {LinuxRegistry} from '@/application/system/protocol/linuxRegistry';
import {OpenCommand, OpenInput, Program} from '@/application/cli/command/open';
import {CliSettingsValidator} from '@/infrastructure/application/validation/cliSettingsValidator';
import {IndexedConfigurationManager} from '@/application/project/configuration/manager/indexedConfigurationManager';
import {Process} from '@/application/system/process/process';
import {ExecutableLocator} from '@/application/system/executableLocator';
import {IsPreferredNodePackageManager} from '@/application/predicate/isPreferredNodePackageManager';
import {WelcomeCommand, WelcomeInput} from '@/application/cli/command/welcome';
import {HasEnvVar} from '@/application/predicate/hasEnvVar';
import {SequentialProvider} from '@/application/provider/sequentialProvider';
import {InvitationForm} from '@/application/cli/form/user/invitationForm';
import {
    InvitationReminderAuthenticator,
} from '@/application/cli/authentication/authenticator/invitationReminderAuthenticator';
import {CliConfigurationProvider} from '@/application/cli/configuration/store';
import {FileConfigurationStore} from '@/application/cli/configuration/fileConfigurationStore';
import {NormalizedConfigurationStore} from '@/application/cli/configuration/normalizedConfigurationStore';
import {CreateApiKeyCommand, CreateApiKeyInput} from '@/application/cli/command/apiKey/create';
import {ApiKeyAuthenticator} from '@/application/cli/authentication/authenticator/apiKeyAuthenticator';
import {VirtualizedWorkingDirectory} from '@/application/fs/workingDirectory/virtualizedWorkingDirectory';
import {ProcessWorkingDirectory} from '@/application/fs/workingDirectory/processWorkingDirectory';
import {CachedAuthenticator} from '@/application/cli/authentication/authenticator/cachedAuthenticator';
import {TokenCache} from '@/infrastructure/cache/tokenCache';

export type Configuration = {
    program: Program,
    process: Process,
    cache: boolean,
    quiet: boolean,
    interactive: boolean,
    apiKey?: ApiKey,
    skipPrompts: boolean,
    adminUrl: URL,
    adminTokenParameter: string,
    templateRegistryUrl: URL,
    deepLinkProtocol: string,
    cliTokenDuration: number,
    cliTokenFreshPeriod: number,
    cliTokenIssuer: string,
    apiKeyTokenDuration: number,
    adminTokenDuration: number,
    directories: {
        current?: string,
        config: string,
        cache: string,
        data: string,
        home: string,
    },
    api: {
        graphqlEndpoint: string,
        tokenEndpoint: string,
        tokenParameter: string,
    },
};

type AuthenticationMethods = {
    credentials: CredentialsInput,
    default: Record<never, never>,
};

type AuthenticationInput = MultiAuthenticationInput<AuthenticationMethods>;

type NodePackageManagers = {
    npm: NodePackageManager,
    yarn: NodePackageManager,
    bun: NodePackageManager,
    pnpm: NodePackageManager,
};

export class Cli {
    // eslint-disable-next-line @typescript-eslint/ban-types -- Any function type is acceptable
    private static readonly READ_ONLY_COMMANDS: Set<Function> = new Set([
        WelcomeCommand,
        InstallCommand,
        UpgradeCommand,
        AddSlotCommand,
        AddComponentCommand,
        RemoveSlotCommand,
        RemoveComponentCommand,
        CreateTemplateCommand,
        OpenCommand,
        LogoutCommand,
    ]);

    private readonly configuration: Configuration;

    private readonly skipPrompts: boolean;

    private readonly workingDirectory: CurrentWorkingDirectory;

    private readonly instances: Map<() => any, any> = new Map();

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
        this.skipPrompts = configuration.skipPrompts;
        this.workingDirectory = new VirtualizedWorkingDirectory(
            configuration.directories.current ?? configuration.process.getCurrentDirectory(),
        );
    }

    public welcome(input: WelcomeInput): Promise<void> {
        return this.execute(
            new WelcomeCommand({
                packageManager: this.getNodePackageManager(),
                protocolRegistryProvider: this.getProtocolRegistryProvider(),
                cliPackage: 'croct@latest',
                protocolHandler: {
                    id: 'com.croct.cli',
                    name: 'croct-cli',
                    protocol: this.configuration.deepLinkProtocol,
                },
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public open(input: OpenInput): Promise<void> {
        return this.execute(
            new OpenCommand({
                program: this.configuration.program,
                protocol: this.configuration.deepLinkProtocol,
                configurationProvider: this.getCliConfigurationStore(),
                workingDirectory: new ProcessWorkingDirectory(this.configuration.process),
                fileSystem: this.getFileSystem(),
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    public init(input: InitInput): Promise<void> {
        return this.execute(
            new InitCommand({
                sdkProvider: this.getSdkProvider(),
                platformProvider: this.getPlatformProvider(),
                configurationManager: this.getConfigurationManager(),
                skipConfirmation: new PredicateProvider(
                    new Or(
                        new Not(
                            new FileExists({
                                fileSystem: this.getFileSystem(),
                                files: ['.git'],
                            }),
                        ),
                    ),
                ),
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
                sdk: this.getSdk(),
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
                sdk: this.getSdk(),
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
                sdk: this.getSdk(),
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
                sdk: this.getSdk(),
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
                sdk: this.getSdk(),
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
                sdk: this.getSdk(),
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
                adminUrl: this.configuration.adminUrl,
                adminTokenParameter: this.configuration.adminTokenParameter,
                adminTokenDuration: this.configuration.adminTokenDuration,
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
        return this.execute(this.getImportTemplateCommand(), input);
    }

    public async getTemplateOptions(template: string): Promise<OptionMap> {
        const command = this.getImportTemplateCommand();
        const output = this.getOutput();

        const notifier = output.notify('Loading template');

        try {
            return await command.getOptions(template);
        } finally {
            notifier.stop();
        }
    }

    private getImportTemplateCommand(): ImportTemplateCommand {
        return new ImportTemplateCommand({
            templateProvider: new ValidatedProvider({
                provider: new JsonProvider(this.getTemplateProvider()),
                validator: new TemplateValidator(),
            }),
            fileSystem: this.getFileSystem(),
            action: this.getImportAction(),
            io: {
                input: this.getInput(),
                output: this.getOutput(),
            },
        });
    }

    public createApiKey(input: CreateApiKeyInput): Promise<void> {
        return this.execute(
            new CreateApiKeyCommand({
                fileSystem: this.getFileSystem(),
                configurationManager: this.getConfigurationManager(),
                api: {
                    user: this.getUserApi(),
                    workspace: this.getWorkspaceApi(),
                    application: this.getApplicationApi(),
                },
                io: {
                    input: this.getFormInput(),
                    output: this.getOutput(),
                },
            }),
            input,
        );
    }

    private getFormInput(instruction?: Instruction): Input {
        return this.getInput() ?? this.getNonInteractiveInput(instruction);
    }

    private getNonInteractiveInput(instruction?: Instruction): Input {
        return new DefaultChoiceInput(
            new NonInteractiveInput(instruction ?? {
                message: 'Input is not available in non-interactive mode.',
            }),
        );
    }

    private getInput(): Input | undefined {
        if (!this.configuration.interactive) {
            return;
        }

        return this.share(this.getInput, () => {
            const output = this.getOutput();
            const input = new ConsoleInput({
                input: this.configuration
                    .process
                    .getStandardInput(),
                output: this.configuration
                    .process
                    .getStandardOutput(),
                onAbort: () => output.exit(),
                onInteractionStart: () => output.suspend(),
                onInteractionEnd: () => output.resume(),
            });

            if (this.skipPrompts) {
                return new DefaultChoiceInput(input);
            }

            return input;
        });
    }

    private getNonInteractiveOutput(quiet = false): ConsoleOutput {
        return new ConsoleOutput({
            output: this.configuration
                .process
                .getStandardOutput(),
            interactive: false,
            quiet: quiet,
            onExit: () => this.configuration
                .process
                .exit(),
        });
    }

    private getOutput(): ConsoleOutput {
        return this.share(
            this.getOutput,
            () => new ConsoleOutput({
                output: this.configuration
                    .process
                    .getStandardOutput(),
                interactive: this.configuration.interactive,
                quiet: this.configuration.quiet,
                onExit: () => this.configuration
                    .process
                    .exit(),
            }),
        );
    }

    private getTemplateProvider(): ResourceProvider<string> {
        return this.share(this.getTemplateProvider, () => {
            const fileNames = ['template.json5', 'template.json'];
            const fileProvider = new FileContentProvider(this.getFileProvider());

            return new CachedProvider({
                cache: AdaptedCache.transformKeys(
                    new AutoSaveCache(new InMemoryCache()),
                    (url: string) => url.toString(),
                ),
                provider: new MultiProvider(
                    ...fileNames.map(
                        fileName => new MappedProvider({
                            dataProvider: fileProvider,
                            registryProvider: new ConstantProvider([
                                {
                                    // Any URL not ending with a file extension, excluding the trailing slash
                                    pattern: /^(.+?:\/+[^/]+(\/+[^/.]+|\/[^/]+(?=\/))*)\/*$/,
                                    destination: `$1/${fileName}`,
                                },
                            ]),
                        }),
                    ),
                ),
            });
        });
    }

    private getFileProvider(): ResourceProvider<FileSystemIterator> {
        return this.share(this.getFileProvider, () => {
            const httpProvider = this.getHttpProvider();
            const localProvider = new FileSystemProvider(this.getFileSystem());

            const remoteProviders = [
                new GithubProvider(httpProvider),
                new HttpFileProvider(httpProvider),
            ];

            return new MultiProvider(
                localProvider,
                new MappedProvider({
                    dataProvider: new MultiProvider(...remoteProviders),
                    registryProvider: new ResourceValueProvider(
                        new SpecificResourceProvider({
                            url: this.configuration.templateRegistryUrl,
                            provider: new ValidatedProvider({
                                provider: new CachedProvider({
                                    cache: new StaleWhileRevalidateCache({
                                        freshPeriod: 60,
                                        cacheProvider: AdaptedCache.transformValues(
                                            this.getCache('name-registry'),
                                            ({value: {url, value}, timestamp}) => TimestampedCacheEntry.toJSON({
                                                timestamp: timestamp,
                                                value: {
                                                    value: value,
                                                    url: url.toString(),
                                                },
                                            }),
                                            (data: string) => {
                                                const {value, timestamp} = TimestampedCacheEntry
                                                    .fromJSON<{value: string, url: string}>(data);

                                                return {
                                                    timestamp: timestamp,
                                                    value: {
                                                        url: new URL(value.url),
                                                        value: value.value,
                                                    },
                                                };
                                            },
                                        ),
                                    }),
                                    provider: new JsonProvider(
                                        new FileContentProvider(new MultiProvider(localProvider, ...remoteProviders)),
                                    ),
                                }),
                                validator: new RegistryValidator(),
                            }),
                        }),
                    ),
                }),
            );
        });
    }

    private getImportAction(): Action<ImportOptions> {
        return this.share(this.getImportAction, () => {
            const fileSystem = this.getFileSystem();

            const actions = {
                run: new ValidatedAction<RunOptions>({
                    action: new LazyAction(new CallbackProvider((): RunAction => new RunAction(actions))),
                    validator: new RunOptionsValidator(),
                }),
                try: new ValidatedAction<TryOptions>({
                    action: new LazyAction(new CallbackProvider((): TryAction => new TryAction(actions.run))),
                    validator: new TryOptionsValidator(),
                }),
                test: new ValidatedAction<TestOptions>({
                    action: new LazyAction(new CallbackProvider((): TestAction => new TestAction(actions.run))),
                    validator: new TestOptionsValidator(),
                }),
                repeat: new ValidatedAction({
                    action: new LazyAction(new CallbackProvider((): RepeatAction => new RepeatAction(actions.run))),
                    validator: new RepeatOptionsValidator(),
                }),
                print: new ValidatedAction({
                    action: new PrintAction(),
                    validator: new PrintOptionsValidator(),
                }),
                fail: new ValidatedAction({
                    action: new FailAction(),
                    validator: new FailOptionsValidator(),
                }),
                define: new ValidatedAction({
                    action: new DefineAction(),
                    validator: new DefineOptionsValidator(),
                }),
                prompt: new ValidatedAction({
                    action: new PromptAction(),
                    validator: new PromptOptionsValidator(),
                }),
                'change-directory': new ValidatedAction({
                    action: new ChangeDirectoryAction({
                        fileSystem: fileSystem,
                        currentDirectory: this.workingDirectory,
                    }),
                    validator: new ChangeDirectoryOptionsValidator(),
                }),
                'open-link': new ValidatedAction({
                    action: new OpenLinkAction(),
                    validator: new OpenLinkOptionsValidator(),
                }),
                'start-server': new ValidatedAction({
                    action: new StartServer({
                        serverProvider: this.getServerProvider(),
                    }),
                    validator: new StartServerOptionsValidator(),
                }),
                'stop-server': new ValidatedAction({
                    action: new StopServer({
                        serverProvider: this.getServerProvider(),
                    }),
                    validator: new StopServerOptionsValidator(),
                }),
                'execute-package': new ValidatedAction({
                    action: new ExecutePackage({
                        packageManager: this.getPackageManager(),
                        packageManagerProvider: this.getPackageManagerRegistry(),
                        workingDirectory: this.workingDirectory,
                        commandExecutor: new PtyExecutor(),
                        commandTimeout: 2 * 60 * 1000, // 2 minutes
                        sourceChecker: {
                            // @todo: Add safety check to prevent running arbitrary commands
                            test: (): boolean => true,
                        },
                    }),
                    validator: new ExecutePackageOptionsValidator(),
                }),
                'check-dependencies': new ValidatedAction({
                    action: new CheckDependencyAction({
                        packageManager: this.getPackageManager(),
                    }),
                    validator: new CheckDependenciesOptionsValidator(),
                }),
                download: new ValidatedAction({
                    action: new DownloadAction({
                        fileSystem: fileSystem,
                        provider: this.getFileProvider(),
                    }),
                    validator: new DownloadOptionsValidator(),
                }),
                'resolve-import': new ValidatedAction({
                    action: new ResolveImportAction({
                        importResolver: this.getImportResolver(),
                    }),
                    validator: new ResolveImportOptionsValidator(),
                }),
                'add-dependency': new ValidatedAction({
                    action: new AddDependencyAction({
                        packageManager: this.getPackageManager(),
                    }),
                    validator: new AddDependencyOptionsValidator(),
                }),
                'locate-file': new ValidatedAction({
                    action: new LocateFileAction({
                        projectDirectory: this.workingDirectory,
                        fileSystem: fileSystem,
                        matcherProvider: {
                            get: async (pattern): Promise<PathMatcher> => {
                                const gitignore = fileSystem.joinPaths(this.workingDirectory.get(), '.gitignore');
                                const predicate = MatchesGlob.fromPattern(pattern);

                                if (await fileSystem.exists(gitignore)) {
                                    const content = await fileSystem.readTextFile(gitignore);

                                    return new And(new Not(MatchesGitignore.fromPatterns(content)), predicate);
                                }

                                return predicate;
                            },
                        },
                    }),
                    validator: new LocateFileOptionsValidator(),
                }),
                'replace-file-content': new ValidatedAction({
                    action: new ReplaceFileContentAction({
                        fileSystem: fileSystem,
                    }),
                    validator: new ReplaceFileContentOptionsValidator(),
                }),
                'add-slot': new ValidatedAction({
                    action: new AddSlotAction({
                        installer: (slots, example): Promise<void> => {
                            const output = this.getNonInteractiveOutput(true);

                            return this.execute(
                                new AddSlotCommand({
                                    sdk: this.getSdk(),
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
                    validator: new AddSlotOptionsValidator(),
                }),
                'add-component': new ValidatedAction({
                    action: new AddComponentAction({
                        installer: (components): Promise<void> => {
                            const output = this.getNonInteractiveOutput(true);

                            return this.execute(
                                new AddComponentCommand({
                                    sdk: this.getSdk(),
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
                    validator: new AddComponentOptionsValidator(),
                }),
                'create-resource': new ValidatedAction({
                    action: new CreateResourceAction({
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
                                message: 'Some resource IDs are in use and interactive mode is '
                                    + 'required to assign new ones.',
                                suggestions: ['Retry in interactive mode'],
                            }),
                            workspaceApi: this.getWorkspaceApi(),
                        }),
                    }),
                    validator: new CreateResourceOptionsValidator(),
                }),
                'format-code': new ValidatedAction({
                    action: new FormatCodeAction({
                        formatter: this.getCodeFormatter(),
                    }),
                    validator: new FormatCodeOptionsValidator(),
                }),
                import: new ValidatedAction<ImportOptions>({
                    action: new LazyAction(
                        new CallbackProvider(
                            (): Action<ImportOptions> => new ImportAction({
                                runner: actions.run,
                                templateProvider: new TemplateProvider({
                                    evaluator: new JsepExpressionEvaluator({
                                        functions: functions,
                                    }),
                                    validator: new TemplateValidator(),
                                    provider: this.getTemplateProvider(),
                                }),
                                variables: this.getActionVariables(),
                            }),
                        ),
                    ),
                    validator: new ImportOptionsValidator(),
                }),
            } satisfies Record<string, ValidatedAction<any>>;

            return actions.import;
        });
    }

    private getActionVariables(): VariableMap {
        const getUrl = (path: string): string => {
            const url = new URL(this.configuration.adminUrl);

            url.pathname += `${path}/`;

            return url.toString();
        };

        return {
            project: {
                organization: LazyPromise.transient(
                    async () => {
                        const {organization} = await this.getConfigurationManager().resolve();

                        return {
                            slug: organization,
                            url: getUrl(`/organizations/${organization}`),
                        };
                    },
                ),
                workspace: LazyPromise.transient(
                    async () => {
                        const {organization, workspace} = await this.getConfigurationManager().resolve();

                        return {
                            slug: workspace,
                            url: getUrl(`/organizations/${organization}/workspaces/${workspace}`),
                        };
                    },
                ),
                application: LazyPromise.transient(
                    async () => {
                        const {organization, workspace, applications} = await this.getConfigurationManager().resolve();
                        const path = `/organizations/${organization}/workspaces/${workspace}/applications/`;

                        return {
                            development: {
                                slug: applications.development,
                                url: getUrl(path + applications.development),
                            },
                            production: {
                                slug: applications.production,
                                url: getUrl(path + applications.production),
                            },
                        };
                    },
                ),
                path: {
                    example: LazyPromise.transient(
                        async () => (await this.getConfigurationManager().resolve()).paths.examples,
                    ),
                    component: LazyPromise.transient(
                        async () => (await this.getConfigurationManager().resolve()).paths.components,
                    ),
                },
                platform: LazyPromise.transient(async () => (await this.getPlatformProvider().get()) ?? 'unknown'),
                server: LazyPromise.transient(async (): Promise<{running: boolean, url?: string}|null> => {
                    const serverProvider = this.getServerProvider();
                    const server = await serverProvider.get();

                    if (server === null) {
                        return null;
                    }

                    try {
                        const status = await server.getStatus();

                        if (status.running) {
                            return {
                                running: true,
                                url: status.url.toString(),
                            };
                        }
                    } catch {
                        // Ignore
                    }

                    return {running: false};
                }),
            },
        };
    }

    private getHttpProvider(): HttpProvider {
        return this.share(this.getHttpProvider, () => new FetchProvider());
    }

    private getAuthenticator(): Authenticator<AuthenticationInput> {
        return this.share(this.getAuthenticator, () => {
            if (this.configuration.apiKey !== undefined) {
                return new ApiKeyAuthenticator({
                    apiKey: this.configuration.apiKey,
                    clock: this.getClock(),
                    tokenDuration: this.configuration.apiKeyTokenDuration,
                });
            }

            const input = this.getFormInput();
            const fileSystem = this.getFileSystem();
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
                        tokenDuration: this.configuration.cliTokenDuration,
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

            const authenticator = new CachedAuthenticator({
                cacheKey: 'token',
                cacheProvider: new TokenCache({
                    userApi: this.getUserApi(true),
                    clock: this.getClock(),
                    cliTokenFreshPeriod: this.configuration.cliTokenFreshPeriod,
                    tokenDuration: this.configuration.cliTokenDuration,
                    tokenIssuer: this.configuration.cliTokenIssuer,
                    cacheProvider: new AutoSaveCache(
                        new FileSystemCache({
                            fileSystem: fileSystem,
                            directory: this.configuration.directories.config,
                            useKeyAsFileName: true,
                        }),
                    ),
                }),
                authenticator: new MultiAuthenticator<AuthenticationMethods>({
                    default: this.configuration.interactive
                        ? credentialsAuthenticator
                        : new NonInteractiveAuthenticator({
                            authenticator: credentialsAuthenticator,
                            instruction: {
                                message: 'Authentication required.',
                                suggestions: ['Run `login` to authenticate'],
                                reason: ErrorReason.PRECONDITION,
                            },
                        }),
                    credentials: credentialsAuthenticator,
                }),
            });

            if (this.configuration.interactive) {
                return new InvitationReminderAuthenticator({
                    authenticator: authenticator,
                    invitationForm: new InvitationForm({
                        output: this.getOutput(),
                        input: input,
                        userApi: this.getUserApi(true),
                    }),
                });
            }

            return authenticator;
        });
    }

    private getSdk(): Sdk {
        return this.share(this.getSdk, () => {
            const provider = new FallbackProvider(
                this.getSdkProvider(),
                new CallbackProvider(() => {
                    throw new ProviderError('No suitable SDK detected.', {
                        reason: ErrorReason.NOT_SUPPORTED,
                        suggestions: [
                            'Make sure you are running the command in the project root directory.',
                        ],
                    });
                }),
            );

            return new LazySdk(provider);
        });
    }

    private getSdkProvider(): Provider<Sdk|null> {
        return this.share(this.getSdkProvider, () => {
            const formatter = this.getJavaScriptFormatter();
            const fileSystem = this.getFileSystem();
            const importResolver = this.getNodeImportResolver();

            const config: JavaScriptSdkConfiguration = {
                projectDirectory: this.workingDirectory,
                packageManager: this.getNodePackageManager(),
                fileSystem: fileSystem,
                formatter: formatter,
                workspaceApi: this.getWorkspaceApi(),
                tsConfigLoader: this.getTsConfigLoader(),
            };

            const unknown = Symbol('unknown');

            return new EnumeratedProvider({
                discriminator: async () => (await this.getPlatformProvider().get()) ?? unknown,
                mapping: {
                    [Platform.JAVASCRIPT]: (): Sdk => new PlugJsSdk(config),
                    [Platform.REACT]: (): Sdk => new PlugReactSdk({
                        ...config,
                        importResolver: importResolver,
                        codemod: {
                            provider: new FormatCode(
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
                                formatter,
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
                    [Platform.NEXTJS]: (): Sdk => new PlugNextSdk({
                        ...config,
                        userApi: this.getUserApi(),
                        applicationApi: this.getApplicationApi(),
                        importResolver: importResolver,
                        codemod: {
                            middleware: new FormatCode(
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
                                formatter,
                            ),
                            appRouterProvider: new FormatCode(
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
                                formatter,
                            ),
                            pageRouterProvider: new FormatCode(
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
                                formatter,
                            ),
                        },
                    }),
                    [unknown]: () => null,
                },
            });
        });
    }

    private getCodeFormatter(): CodeFormatter {
        return this.share(this.getCodeFormatter, () => {
            const unknown = Symbol('unknown');

            return new LazyFormatter(
                new EnumeratedProvider({
                    discriminator: async () => (await this.getPlatformProvider().get()) ?? unknown,
                    mapping: {
                        [Platform.JAVASCRIPT]: () => this.getJavaScriptFormatter(),
                        [Platform.REACT]: () => this.getJavaScriptFormatter(),
                        [Platform.NEXTJS]: () => this.getJavaScriptFormatter(),
                        [unknown]: (): never => {
                            throw new ProviderError('No code formatter detected.', {
                                reason: ErrorReason.NOT_SUPPORTED,
                                suggestions: [
                                    'Make sure you are running the command in the project root directory.',
                                ],
                            });
                        },
                    },
                }),
            );
        });
    }

    private share<M extends(() => any)>(method: M, factory: () => ReturnType<M>): ReturnType<M> {
        const instance = this.instances.get(method);

        if (instance === undefined) {
            const newInstance = factory();

            this.instances.set(method, newInstance);

            return newInstance;
        }

        return instance;
    }

    private getPackageManagerRegistry(): EntryProvider<string, PackageManager> {
        return this.share(
            this.getPackageManagerRegistry,
            () => new MapProvider(new Map(Object.entries(this.getPackageManagers()))),
        );
    }

    private getPackageManagers(): Record<string, PackageManager> {
        return this.getNodePackageManagers();
    }

    private getPackageManager(): PackageManager {
        return this.share(
            this.getPackageManager,
            () => new LazyPackageManager(
                new FallbackProvider(
                    // To add more package managers, wrap the current detector with a SequentialProvider
                    this.getNodePackageManagerProvider(),
                    new CallbackProvider(() => {
                        throw new ProviderError('No package manager detected.', {
                            reason: ErrorReason.NOT_SUPPORTED,
                            suggestions: [
                                'Make sure you are running the command in the project root directory.',
                                'Initialize your project and retry the command.',
                            ],
                        });
                    }),
                ),
            ),
        );
    }

    private getNodePackageManager(): PackageManager {
        return this.share(this.getNodePackageManager, () => {
            const managers = this.getNodePackageManagers();

            return new LazyPackageManager(
                new FallbackProvider(
                    this.getNodePackageManagerProvider(),
                    new ConstantProvider(managers.npm),
                ),
            );
        });
    }

    public getNodePackageManagerProvider(): Provider<PackageManager|null> {
        return this.share(this.getNodePackageManagerProvider, () => {
            const managers = this.getNodePackageManagers();
            const fileSystem = this.getFileSystem();

            const lockFiles: Record<keyof NodePackageManagers, string[]> = {
                npm: ['package-lock.json'],
                yarn: ['yarn.lock'],
                bun: ['bun.lock', 'bun.lockb'],
                pnpm: ['pnpm-lock.yaml'],
            };

            return new MemoizedProvider(
                new SequentialProvider(
                    // Give higher priority to the package manager detected by the user agent
                    new ConditionalProvider({
                        candidates: (Object.entries(managers)).map(
                            ([name, manager]) => ({
                                value: manager,
                                condition: new HasEnvVar({
                                    process: this.configuration.process,
                                    variable: 'npm_config_user_agent',
                                    value: new RegExp(`^${name}`),
                                }),
                            }),
                        ),
                    }),
                    // Then, try to detect the package manager by the `packageManager` field
                    // in the `package.json` file or by the presence of the lock file
                    new ConditionalProvider({
                        candidates: (Object.entries(managers)).map(
                            ([name, manager]) => ({
                                value: manager,
                                condition: new Or(
                                    new IsPreferredNodePackageManager({
                                        packageManager: name,
                                        fileSystem: fileSystem,
                                        projectDirectory: this.workingDirectory,
                                    }),
                                    new FileExists({
                                        fileSystem: fileSystem,
                                        files: lockFiles[name as keyof NodePackageManagers],
                                    }),
                                ),
                            }),
                        ),
                    }),
                ),
                this.workingDirectory,
            );
        });
    }

    private getNodePackageManagers(): NodePackageManagers {
        return this.share(this.getNodePackageManagers, () => {
            const fileSystem = this.getFileSystem();

            const agentConfig: ExecutableAgentConfiguration = {
                projectDirectory: this.workingDirectory,
                fileSystem: fileSystem,
                commandExecutor: this.getCommandExecutor(),
                executableLocator: this.getExecutableLocator(),
            };

            const validator = new PartialNpmPackageValidator();

            const managerConfig: Omit<NodePackageManagerConfiguration, 'agent'> = {
                fileSystem: fileSystem,
                projectDirectory: this.workingDirectory,
                packageValidator: validator,
            };

            return {
                npm: new NodePackageManager({
                    ...managerConfig,
                    agent: new NpmAgent(agentConfig),
                }),
                yarn: new NodePackageManager({
                    ...managerConfig,
                    agent: new YarnAgent(agentConfig),
                }),
                bun: new NodePackageManager({
                    ...managerConfig,
                    agent: new BunAgent(agentConfig),
                }),
                pnpm: new NodePackageManager({
                    ...managerConfig,
                    agent: new PnpmAgent(agentConfig),
                }),
            };
        });
    }

    private getNodeServerProvider(): Provider<Server|null> {
        return this.share(
            this.getNodeServerProvider,
            () => new ProjectServerProvider({
                packageManager: this.getNodePackageManager(),
                factory: this.getServerFactory(),
                parsers: [
                    new NextCommandParser(),
                    new ViteCommandParser(),
                    new ParcelCommandParser(),
                    new ReactScriptCommandParser(),
                ],
            }),
        );
    }

    private getServerProvider(): Provider<Server|null> {
        return this.share(this.getServerProvider, () => {
            const unknown = Symbol('unknown');

            return new EnumeratedProvider({
                discriminator: async () => (await this.getPlatformProvider().get()) ?? unknown,
                mapping: {
                    [Platform.JAVASCRIPT]: () => this.getNodeServerProvider().get(),
                    [Platform.REACT]: () => this.getNodeServerProvider().get(),
                    [Platform.NEXTJS]: () => this.getNodeServerProvider().get(),
                    [unknown]: () => null,
                },
            });
        });
    }

    private getServerFactory(): ServerFactory {
        return this.share(
            this.getServerFactory,
            () => new CachedServerFactory(
                new ProcessServerFactory({
                    commandExecutor: this.getCommandExecutor(),
                    workingDirectory: this.workingDirectory,
                    startupTimeout: 20_000,
                    startupCheckDelay: 1500,
                    lookupMaxPorts: 30,
                    lookupTimeout: 2_000,
                    processObserver: this.configuration.process,
                }),
            ),
        );
    }

    private getJavaScriptFormatter(): CodeFormatter {
        return this.share(
            this.getJavaScriptFormatter,
            () => new JavaScriptFormatter({
                commandExecutor: this.getCommandExecutor(),
                workingDirectory: this.workingDirectory,
                packageManager: this.getNodePackageManager(),
                fileSystem: this.getFileSystem(),
                timeout: 10_000,
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
            }),
        );
    }

    private getImportResolver(): ImportResolver {
        return this.share(this.getImportResolver, () => {
            const nodeImportResolver = this.getNodeImportResolver();

            const unknown = Symbol('unknown');

            return new LazyImportResolver(
                new EnumeratedProvider({
                    discriminator: async () => (await this.getPlatformProvider().get()) ?? unknown,
                    mapping: {
                        [Platform.JAVASCRIPT]: () => nodeImportResolver,
                        [Platform.REACT]: () => nodeImportResolver,
                        [Platform.NEXTJS]: () => nodeImportResolver,
                        [unknown]: (): never => {
                            throw new CallbackProvider(() => {
                                throw new ProviderError('No import resolver detected.', {
                                    reason: ErrorReason.NOT_SUPPORTED,
                                    suggestions: [
                                        'Make sure you are running the command in the project root directory.',
                                    ],
                                });
                            });
                        },
                    },
                }),
            );
        });
    }

    private getNodeImportResolver(): ImportResolver {
        return this.share(
            this.getNodeImportResolver,
            () => new NodeImportResolver({
                fileSystem: this.getFileSystem(),
                tsConfigLoader: this.getTsConfigLoader(),
                projectDirectory: this.workingDirectory,
            }),
        );
    }

    private getTsConfigLoader(): TsConfigLoader {
        return this.share(
            this.getTsConfigLoader,
            () => new TsConfigLoader({
                fileSystem: this.getFileSystem(),
                tsconfigValidator: new PartialTsconfigValidator(),
            }),
        );
    }

    private getCommandExecutor(): CommandExecutor & SynchronousCommandExecutor {
        return this.share(this.getCommandExecutor, () => new SpawnExecutor());
    }

    private getExecutableLocator(): ExecutableLocator {
        return this.share(
            this.getExecutableLocator,
            () => {
                const {process} = this.configuration;

                return new ExecutableLocator({
                    fileSystem: this.getFileSystem(),
                    cache: new AutoSaveCache(new InMemoryCache()),
                    executablePaths: process.getEnvList('PATH') ?? [],
                    executableExtensions: process.getEnvList('PATHEXT') ?? [],
                });
            },
        );
    }

    private getPlatformProvider(): Provider<Platform|null> {
        return this.share(this.getPlatformProvider, () => {
            const nodePackageManager = new NodePackageManager({
                projectDirectory: this.workingDirectory,
                packageValidator: new PartialNpmPackageValidator(),
                fileSystem: this.getFileSystem(),
                agent: new NoopAgent(),
            });

            return new MemoizedProvider(
                new ConditionalProvider({
                    candidates: [
                        {
                            value: Platform.NEXTJS,
                            condition: new HasDependency({
                                packageManager: nodePackageManager,
                                dependencies: ['next'],
                            }),
                        },
                        {
                            value: Platform.REACT,
                            condition: new HasDependency({
                                packageManager: nodePackageManager,
                                dependencies: ['react'],
                            }),
                        },
                        {
                            value: Platform.JAVASCRIPT,
                            condition: new IsProject({
                                packageManager: nodePackageManager,
                            }),
                        },
                    ],
                }),
                this.workingDirectory,
            );
        });
    }

    private getConfigurationManager(): ConfigurationManager {
        return this.share(this.getConfigurationManager, () => {
            const output = this.getOutput();
            const manager = new ConfigurationFileManager({
                file: new JsonFileConfiguration({
                    fileSystem: this.getFileSystem(),
                    validator: new CroctConfigurationValidator(),
                    projectDirectory: this.workingDirectory,
                }),
                output: output,
                api: {
                    user: this.getUserApi(),
                    organization: this.getOrganizationApi(),
                    workspace: this.getWorkspaceApi(),
                },
            });

            return new IndexedConfigurationManager({
                workingDirectory: this.workingDirectory,
                store: this.getCliConfigurationStore(),
                manager: new CachedConfigurationManager(
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
                ),
            });
        });
    }

    private getUserApi(optionalAuthentication = false): UserApi {
        if (optionalAuthentication) {
            return new GraphqlUserApi(this.getGraphqlClient(true));
        }

        return this.share(this.getUserApi, () => new GraphqlUserApi(this.getGraphqlClient()));
    }

    private getOrganizationApi(): OrganizationApi {
        return this.share(this.getOrganizationApi, () => new GraphqlOrganizationApi(this.getGraphqlClient()));
    }

    private getWorkspaceApi(): WorkspaceApi {
        return this.share(this.getWorkspaceApi, () => new GraphqlWorkspaceApi(this.getGraphqlClient()));
    }

    private getApplicationApi(): ApplicationApi {
        return this.share(this.getApplicationApi, () => new GraphqlApplicationApi(this.getGraphqlClient()));
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

        return this.share(this.getGraphqlClient, () => {
            const authenticator = this.getAuthenticator();

            return new FetchGraphqlClient({
                endpoint: this.configuration.api.graphqlEndpoint,
                tokenProvider: {
                    getToken: async () => (await authenticator.getToken())
                        ?? (authenticator.login({method: 'default'})),
                },
            });
        });
    }

    private getAuthenticationListener(): AuthenticationListener {
        return this.share(
            this.getAuthenticationListener,
            () => new FocusListener({
                platform: process.platform,
                commandExecutor: this.getCommandExecutor(),
                timeout: 2_000,
                listener: new HttpPollingListener({
                    endpoint: this.configuration.api.tokenEndpoint,
                    parameter: this.configuration.api.tokenParameter,
                    pollingInterval: 1000,
                }),
            }),
        );
    }

    private getFileSystem(): FileSystem {
        return this.share(
            this.getFileSystem,
            () => new LocalFilesystem({
                workingDirectory: this.workingDirectory,
                defaultEncoding: 'utf-8',
            }),
        );
    }

    private createEmailLinkGenerator(subject?: string): (email: string) => Promise<URL | null> {
        const generator = this.getEmailLinkGenerator();
        const clock = this.getClock();

        return email => generator.generate({
            recipient: email,
            sender: 'croct.com',
            subject: subject,
            timestamp: Instant.now(clock).getSeconds(),
        });
    }

    private getEmailLinkGenerator(): EmailLinkGenerator {
        return this.share(
            this.getEmailLinkGenerator,
            () => new EmailLinkGenerator({
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
            }),
        );
    }

    private getClock(): Clock {
        return SystemClock.UTC;
    }

    private getCache(namespace: string): CacheProvider<string, string> {
        if (!this.configuration.cache) {
            return new NoopCache();
        }

        return new PrefixedCache(this.getCacheProvider(), namespace);
    }

    private getCacheProvider(): CacheProvider<string, string> {
        return this.share(
            this.getCacheProvider,
            () => new FileSystemCache({
                fileSystem: this.getFileSystem(),
                directory: this.configuration.directories.cache,
            }),
        );
    }

    private getProtocolRegistryProvider(): Provider<ProtocolRegistry|null> {
        return this.share(
            this.getProtocolRegistryProvider,
            () => new CallbackProvider(() => {
                const fileSystem = this.getFileSystem();
                const {process} = this.configuration;

                switch (process.getPlatform()) {
                    case 'darwin':
                        return new MacOsRegistry({
                            fileSystem: fileSystem,
                            appDirectory: fileSystem.joinPaths(this.configuration.directories.data, 'apps'),
                            commandExecutor: this.getCommandExecutor(),
                        });

                    case 'win32':
                        return new WindowsRegistry({
                            commandExecutor: this.getCommandExecutor(),
                        });

                    case 'linux':
                        return new LinuxRegistry({
                            fileSystem: fileSystem,
                            homeDirectory: this.configuration.directories.home,
                            commandExecutor: this.getCommandExecutor(),
                        });

                    default:
                        return null;
                }
            }),
        );
    }

    private getCliConfigurationStore(): CliConfigurationProvider {
        return this.share(this.getCliConfigurationStore, () => {
            const fileSystem = this.getFileSystem();

            return new NormalizedConfigurationStore({
                fileSystem: fileSystem,
                store: new FileConfigurationStore({
                    fileSystem: fileSystem,
                    validator: new CliSettingsValidator(),
                    filePath: fileSystem.joinPaths(this.configuration.directories.config, 'config.json'),
                }),
            });
        });
    }

    private async execute<I extends CommandInput>(command: Command<I>, input: I): Promise<void> {
        if (this.configuration.apiKey !== undefined && !Cli.READ_ONLY_COMMANDS.has(command.constructor)) {
            return this.reportError(
                new HelpfulError('This command does not support API key authentication.', {
                    reason: ErrorReason.PRECONDITION,
                    suggestions: ['Run the command without specifying an API key.'],
                }),
            );
        }

        try {
            await command.execute(input);
        } catch (error) {
            const formattedError = Cli.handleError(error);

            if (error instanceof Error && formattedError instanceof Error) {
                formattedError.stack = error.stack;
            }

            return this.reportError(formattedError);
        }
    }

    private reportError(error: unknown): Promise<never> {
        const output = this.getOutput();

        output.report(Cli.handleError(error));

        return output.exit();
    }

    private static handleError(error: unknown): any {
        switch (true) {
            case error instanceof ApiError:
                if (error.isAccessDenied()) {
                    return new HelpfulError(
                        'Your user lacks the necessary permissions to complete this operation.',
                        {
                            reason: ErrorReason.ACCESS_DENIED,
                            details: error.problems.map(detail => detail.detail ?? detail.title),
                            suggestions: ['Contact your organization or workspace administrator for assistance.'],
                            cause: error,
                        },
                    );
                }

                break;

            case error instanceof ConfigurationError:
                return new HelpfulError(
                    error.message,
                    {
                        ...error.help,
                        suggestions: ['Run `init` to create a new configuration.'],
                    },
                );
        }

        return error;
    }
}
