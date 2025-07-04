import {AutoSaveCache, CacheProvider, InMemoryCache} from '@croct/cache';
import {ApiKey} from '@croct/sdk/apiKey';
import {Clock, Instant, LocalTime} from '@croct/time';
import {SystemClock} from '@croct/time/clock/systemClock.js';
import {homedir} from 'os';
import XDGAppPaths from 'xdg-app-paths';
import ci from 'ci-info';
import {FilteredLogger, Logger, LogLevel} from '@croct/logging';
import {Token} from '@croct/sdk/token';
import {ConsoleInput} from '@/infrastructure/application/cli/io/consoleInput';
import {ConsoleOutput, LinkOpener} from '@/infrastructure/application/cli/io/consoleOutput';
import {Sdk} from '@/application/project/sdk/sdk';
import {Configuration as JavaScriptSdkConfiguration} from '@/application/project/sdk/javasScriptSdk';
import {PlugJsSdk} from '@/application/project/sdk/plugJsSdk';
import {PlugReactSdk} from '@/application/project/sdk/plugReactSdk';
import {PlugNextSdk} from '@/application/project/sdk/plugNextSdk';
import {InitCommand, InitInput} from '@/application/cli/command/init';
import {LoginCommand, LoginInput} from '@/application/cli/command/login';
import {LogoutCommand} from '@/application/cli/command/logout';
import {Input} from '@/application/cli/io/input';
import {JsonConfigurationFileManager} from '@/application/project/configuration/manager/jsonConfigurationFileManager';
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
import {JsxWrapperCodemod} from '@/application/project/code/transformation/javascript/jsxWrapperCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {NextJsMiddlewareCodemod} from '@/application/project/code/transformation/javascript/nextJsMiddlewareCodemod';
import {CodeFormatter} from '@/application/project/code/formatting/formatter';
import {FormatCodemod} from '@/application/project/code/transformation/formatCodemod';
import {FileCodemod} from '@/application/project/code/transformation/fileCodemod';
import {
    NextJsLayoutComponentCodemod,
} from '@/application/project/code/transformation/javascript/nextJsLayoutComponentCodemod';
import {
    NextJsAppComponentCodemod,
} from '@/application/project/code/transformation/javascript/nextJsAppComponentCodemod';
import {JavaScriptFormatter} from '@/infrastructure/application/project/javaScriptFormatter';
import {AddSlotCommand, AddSlotInput} from '@/application/cli/command/slot/add';
import {SlotForm} from '@/application/cli/form/workspace/slotForm';
import {AddComponentCommand, AddComponentInput} from '@/application/cli/command/component/add';
import {ComponentForm} from '@/application/cli/form/workspace/componentForm';
import {RemoveSlotCommand, RemoveSlotInput} from '@/application/cli/command/slot/remove';
import {RemoveComponentCommand, RemoveComponentInput} from '@/application/cli/command/component/remove';
import {
    ConfigurationManager,
    InitializationState,
} from '@/application/project/configuration/manager/configurationManager';
import {NewConfigurationManager} from '@/application/project/configuration/manager/newConfigurationManager';
import {InstallCommand, InstallInput} from '@/application/cli/command/install';
import {PageForm} from '@/application/cli/form/page';
import {NonInteractiveAuthenticator} from '@/application/cli/authentication/authenticator/nonInteractiveAuthenticator';
import {Instruction, NonInteractiveInput} from '@/application/cli/io/nonInteractiveInput';
import {
    MultiAuthenticationInput,
    MultiAuthenticator,
} from '@/application/cli/authentication/authenticator/multiAuthenticator';
import {ApiError} from '@/application/api/error';
import {UpgradeCommand, UpgradeInput} from '@/application/cli/command/upgrade';
import {ProjectConfigurationError, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import {FileSystem, FileSystemIterator, ScanFilter} from '@/application/fs/fileSystem';
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
import {UseTemplateCommand, UseTemplateInput} from '@/application/cli/command/template/use';
import {DownloadAction} from '@/application/template/action/downloadAction';
import {AddDependencyAction} from '@/application/template/action/addDependencyAction';
import {LocatePathAction} from '@/application/template/action/locatePathAction';
import {ReplaceFileContentAction} from '@/application/template/action/replaceFileContentAction';
import {OptionMap, SourceLocation} from '@/application/template/template';
import {AddSlotAction} from '@/application/template/action/addSlotAction';
import {AddComponentAction} from '@/application/template/action/addComponentAction';
import {TryAction, TryOptions} from '@/application/template/action/tryAction';
import {LazyAction} from '@/application/template/action/lazyAction';
import {CachedConfigurationManager} from '@/application/project/configuration/manager/cachedConfigurationManager';
import {CreateResourceAction} from '@/application/template/action/createResourceAction';
import {SlugMappingForm} from '@/application/cli/form/workspace/slugMappingForm';
import {ResourceMatcher} from '@/application/template/resourceMatcher';
import {FetchProvider} from '@/application/provider/resource/fetchProvider';
import {CheckDependencyAction} from '@/application/template/action/checkDependencyAction';
import {HttpProvider} from '@/application/provider/resource/httpProvider';
import {MappedProvider} from '@/application/provider/resource/mappedProvider';
import {MultiProvider} from '@/application/provider/resource/multiProvider';
import {FileSystemProvider} from '@/application/provider/resource/fileSystemProvider';
import {GithubProvider} from '@/application/provider/resource/githubProvider';
import {HttpFileProvider} from '@/application/provider/resource/httpFileProvider';
import {ResourceProvider, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {ErrorReason, HelpfulError} from '@/application/error';
import {PartialNpmPackageValidator} from '@/infrastructure/application/validation/partialNpmPackageValidator';
import {
    FullCroctConfigurationValidator,
    PartialCroctConfigurationValidator,
} from '@/infrastructure/application/validation/croctConfigurationValidator';
import {ValidatedProvider} from '@/application/provider/resource/validatedProvider';
import {FileContentProvider} from '@/application/provider/resource/fileContentProvider';
import {Json5Provider} from '@/application/provider/resource/json5Provider';
import {RegistryValidator} from '@/infrastructure/application/validation/registryValidator';
import {FileSystemCache} from '@/infrastructure/cache/fileSystemCache';
import {CachedProvider} from '@/application/provider/resource/cachedProvider';
import {JsepExpressionEvaluator} from '@/infrastructure/application/evaluation/jsepExpressionEvaluator';
import {TemplateValidator} from '@/infrastructure/application/validation/templateValidator';
import {ImportAction, ImportOptions} from '@/application/template/action/importAction';
import {Action, ActionError} from '@/application/template/action/action';
import {ValidatedAction} from '@/application/template/action/validatedAction';
import {TryOptionsValidator} from '@/infrastructure/application/validation/actions/tryOptionsValidator';
import {
    CheckDependenciesOptionsValidator,
} from '@/infrastructure/application/validation/actions/checkDependenciesOptionsValidator';
import {DownloadOptionsValidator} from '@/infrastructure/application/validation/actions/downloadOptionsValidator';
import {
    AddDependencyOptionsValidator,
} from '@/infrastructure/application/validation/actions/addDependencyOptionsValidator';
import {LocatePathOptionsValidator} from '@/infrastructure/application/validation/actions/locatePathOptionsValidator';
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
import {TemplateProvider} from '@/application/template/templateProvider';
import {FormatCodeAction} from '@/application/template/action/formatCodeAction';
import {FormatCodeOptionsValidator} from '@/infrastructure/application/validation/actions/formatCodeOptionsValidator';
import {EnumeratedProvider} from '@/application/provider/enumeratedProvider';
import {TestAction, TestOptions} from '@/application/template/action/testAction';
import {TestOptionsValidator} from '@/infrastructure/application/validation/actions/testOptionsValidator';
import {PrintAction} from '@/application/template/action/printAction';
import {PrintOptionsValidator} from '@/infrastructure/application/validation/actions/printOptionsValidator';
import {FailAction} from '@/application/template/action/failAction';
import {FailOptionsValidator} from '@/infrastructure/application/validation/actions/failOptionsValidator';
import {SpecificResourceProvider} from '@/application/provider/resource/specificResourceProvider';
import {ConstantProvider} from '@/application/provider/constantProvider';
import {Server} from '@/application/project/server/server';
import {ProjectServerProvider} from '@/application/project/server/provider/projectServerProvider';
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
import {EvaluationError, VariableMap} from '@/application/template/evaluation';
import {StopServerOptionsValidator} from '@/infrastructure/application/validation/actions/stopServerOptionsValidator';
import {ProcessServerFactory} from '@/application/project/server/factory/processServerFactory';
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
import {PackageManager} from '@/application/project/packageManager/packageManager';
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
import {CommandExecutor, SynchronousCommandExecutor} from '@/application/system/process/executor';
import {SpawnExecutor} from '@/infrastructure/application/system/command/spawnExecutor';
import {LazyFormatter} from '@/application/project/code/formatting/lazyFormatter';
import {LazySdk} from '@/application/project/sdk/lazySdk';
import {MemoizedProvider} from '@/application/provider/memoizedProvider';
import {Not} from '@/application/predicate/not';
import {MatchesGitignore} from '@/application/predicate/matchesGitignore';
import {LazyPromise} from '@/infrastructure/promise';
import {PredicateProvider} from '@/application/provider/predicateProvider';
import {DefaultChoiceInput} from '@/application/cli/io/defaultChoiceInput';
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
import {CliConfigurationProvider} from '@/application/cli/configuration/provider';
import {CachedConfigurationStore} from '@/application/cli/configuration/cachedConfigurationStore';
import {NormalizedConfigurationStore} from '@/application/cli/configuration/normalizedConfigurationStore';
import {CreateApiKeyCommand, CreateApiKeyInput} from '@/application/cli/command/apiKey/create';
import {ApiKeyAuthenticator} from '@/application/cli/authentication/authenticator/apiKeyAuthenticator';
import {VirtualizedWorkingDirectory} from '@/application/fs/workingDirectory/virtualizedWorkingDirectory';
import {ProcessWorkingDirectory} from '@/application/fs/workingDirectory/processWorkingDirectory';
import {CachedAuthenticator} from '@/application/cli/authentication/authenticator/cachedAuthenticator';
import {TokenCache} from '@/infrastructure/cache/tokenCache';
import {SessionCloseListener} from '@/infrastructure/application/cli/io/sessionCloseListener';
import {LogFormatter} from '@/application/cli/io/logFormatter';
import {BoxenFormatter} from '@/infrastructure/application/cli/io/boxenFormatter';
import {NodeProcess} from '@/infrastructure/application/system/nodeProcess';
import {CallbackAction} from '@/application/template/action/callbackAction';
import {
    IntegrateCroctOptionsValidator,
} from '@/infrastructure/application/validation/actions/integrateCroctOptionsValidator';
import {NpmRegistryProvider} from '@/application/provider/resource/npmRegistryProvider';
import {HttpResponseBody} from '@/application/provider/resource/httpResponseBody';
import {
    PartialNpmRegistryMetadataValidator,
} from '@/infrastructure/application/validation/partialNpmRegistryMetadataValidator';
import {TraceProvider} from '@/application/provider/resource/traceProvider';
import {TreeLogger} from '@/application/logging/treeLogger';
import {OutputLogger} from '@/infrastructure/application/cli/io/outputLogger';
import {HierarchicalLogger} from '@/application/logging/hierarchicalLogger';
import {GlobImportCodemod} from '@/application/project/code/transformation/globImportCodemod';
import {PathBasedCodemod} from '@/application/project/code/transformation/pathBasedCodemod';
import {getExportedNames} from '@/application/project/code/transformation/javascript/utils/getExportedNames';
import {JavaScriptImportCodemod} from '@/application/project/code/transformation/javascript/javaScriptImportCodemod';
import {ChainedCodemod} from '@/application/project/code/transformation/chainedCodemod';
import {AttributeType} from '@/application/project/code/transformation/javascript/utils/createJsxProps';
import {HierarchyResolver} from '@/infrastructure/application/api/graphql/hierarchyResolver';
import {MacOsFirefoxRegistry} from '@/application/system/protocol/macOsFirefoxRegistry';
import {FirefoxRegistry} from '@/application/system/protocol/firefoxRegistry';
import {DeepLinkCommand, DeepLinkInput} from '@/application/cli/command/deep-link';
import {FileSystemTsConfigLoader} from '@/application/project/import/fileSystemTsConfigLoader';
import {ResolvedCommandExecutor} from '@/infrastructure/application/system/command/resolvedCommandExecutor';
import {TypeErasureCodemod} from '@/application/project/code/transformation/javascript/typeErasureCodemod';
import {ExecutableExists} from '@/application/predicate/executableExists';
import {ServerFactory} from '@/application/project/server/factory/serverFactory';
import {StopServer} from '@/application/template/action/stopServerAction';
import {ProvidedTokenAuthenticator} from '@/application/cli/authentication/authenticator/providedTokenAuthenticator';
import {LazyLinkOpener} from '@/infrastructure/application/cli/io/lazyLinkOpener';
import {ConsoleLinkOpener} from '@/infrastructure/application/cli/io/consoleLinkOpener';
import {BrowserLinkOpener} from '@/infrastructure/application/cli/io/browserLinkOpener';
import {InstallAction} from '@/application/template/action/installAction';
import {InstallOptionsValidator} from '@/infrastructure/application/validation/actions/installOptionsValidator';
import {MovePathAction} from '@/application/template/action/movePathAction';
import {ReadFileAction} from '@/application/template/action/readFile';
import {MovePathOptionsValidator} from '@/infrastructure/application/validation/actions/movePathOptionsValidator';
import {ReadFileOptionsValidator} from '@/infrastructure/application/validation/actions/readFileOptionsValidator';
import {CreateDirectoryAction} from '@/application/template/action/createDirectory';
import {
    CreateDirectoryOptionsValidator,
} from '@/infrastructure/application/validation/actions/createDirectoryOptionsValidator';
import {WriteFileAction} from '@/application/template/action/writeFile';
import {WriteFileOptionsValidator} from '@/infrastructure/application/validation/actions/writeFileOptionsValidator';
import {AutoUpdater} from '@/application/cli/autoUpdater';
import {DeletePathAction} from '@/application/template/action/deletePathAction';
import {DeletePathOptionsValidator} from '@/infrastructure/application/validation/actions/deletePathOptionsValidator';
import {Codemod} from '@/application/project/code/transformation/codemod';
import {ResolveImportAction} from '@/application/template/action/resolveImportAction';
import {
    ResolveImportOptionsValidator,
} from '@/infrastructure/application/validation/actions/resolveImportOptionsValidator';
import {CreateApiKeyAction} from '@/application/template/action/createApiKeyAction';
import {
    CreateApiKeyOptionsValidator,
} from '@/infrastructure/application/validation/actions/createApiKeyOptionsValidator';

export type Configuration = {
    program: Program,
    process: Process,
    quiet: boolean,
    debug: boolean,
    stateless: boolean,
    interactive: boolean,
    version: string,
    apiKey?: ApiKey,
    token?: Token,
    dnd: boolean,
    adminUrl: URL,
    adminTokenParameter: string,
    adminGraphqlEndpoint: URL,
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
    verificationLinkDestination: {
        passwordReset: string,
        accountActivation: string,
    },
    emailSubject: {
        passwordReset: string,
        accountActivation: string,
    },
};

export type Options =
    Partial<Omit<Configuration, | 'directories' | 'verificationLinkDestination' | 'emailSubject'>>
    & {
    directories?: Partial<Configuration['directories']>,
    verificationLinkDestination?: Partial<Configuration['verificationLinkDestination']>,
    emailSubject?: Partial<Configuration['emailSubject']>,
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

type ProviderTracingOptions<T> = {
    provider: ResourceProvider<T>,
    label?: string,
};

export class Cli {
    // eslint-disable-next-line @typescript-eslint/ban-types -- Object.prototype.constructor is a Function
    private static readonly READ_ONLY_COMMANDS: Set<Function> = new Set([
        WelcomeCommand,
        InstallCommand,
        UpgradeCommand,
        AddSlotCommand,
        AddComponentCommand,
        RemoveSlotCommand,
        RemoveComponentCommand,
        CreateTemplateCommand,
        LogoutCommand,
    ]);

    private readonly configuration: Configuration;

    private readonly initialDirectory: string;

    private readonly workingDirectory: CurrentWorkingDirectory;

    private readonly instances: Map<() => any, any> = new Map();

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
        this.initialDirectory = configuration.directories.current ?? configuration.process.getCurrentDirectory();
        this.workingDirectory = new VirtualizedWorkingDirectory(this.initialDirectory);
    }

    public static fromDefaults(configuration: Options): Cli {
        const appPaths = XDGAppPaths('com.croct.cli');
        const process = new NodeProcess();

        return new Cli({
            program: configuration.program ?? ((): never => {
                throw new HelpfulError('CLI is running in standalone mode.');
            }),
            process: configuration.process ?? process,
            quiet: configuration.quiet ?? false,
            debug: configuration.debug ?? false,
            stateless: configuration.stateless ?? ci.isCI,
            interactive: configuration.interactive ?? !ci.isCI,
            version: configuration.version ?? '0.0.0',
            apiKey: configuration.apiKey,
            token: configuration.token,
            dnd: configuration.dnd ?? ci.isCI,
            adminTokenDuration: configuration.adminTokenDuration ?? 7 * LocalTime.SECONDS_PER_DAY,
            apiKeyTokenDuration: configuration.apiKeyTokenDuration ?? 30 * LocalTime.SECONDS_PER_MINUTE,
            cliTokenDuration: configuration.cliTokenDuration ?? 90 * LocalTime.SECONDS_PER_DAY,
            cliTokenFreshPeriod: configuration.cliTokenFreshPeriod ?? 15 * LocalTime.SECONDS_PER_DAY,
            cliTokenIssuer: configuration.cliTokenIssuer ?? 'croct.com',
            deepLinkProtocol: configuration.deepLinkProtocol ?? 'croct',
            templateRegistryUrl: configuration.templateRegistryUrl
                ?? new URL('github://croct-tech/templates/templates/registry.json5'),
            adminUrl: configuration.adminUrl
                ?? new URL('https://app.croct.com'),
            adminTokenParameter: configuration.adminTokenParameter ?? 'accessToken',
            adminGraphqlEndpoint: configuration?.adminGraphqlEndpoint
                ?? new URL('https://app.croct.com/graphql'),
            directories: {
                current: configuration.directories?.current ?? process.getCurrentDirectory(),
                config: configuration.directories?.config ?? appPaths.config(),
                cache: configuration.directories?.cache ?? appPaths.cache(),
                data: configuration.directories?.data ?? appPaths.data(),
                home: configuration.directories?.home ?? homedir(),
            },
            verificationLinkDestination: {
                accountActivation: configuration.verificationLinkDestination?.accountActivation ?? './cli',
                passwordReset: configuration.verificationLinkDestination?.passwordReset ?? './cli',
            },
            emailSubject: {
                passwordReset: configuration.emailSubject?.passwordReset ?? 'Forgot password',
                accountActivation: configuration.emailSubject?.accountActivation ?? 'Welcome to Croct',
            },
        });
    }

    public welcome(input: WelcomeInput): Promise<void> {
        const skip = !this.configuration.interactive || this.configuration.dnd;

        return this.execute(
            new WelcomeCommand({
                cliVersion: this.configuration.version,
                autoUpdater: new AutoUpdater({
                    currentVersion: this.configuration.version,
                    input: this.getInput(),
                    configurationProvider: this.getCliConfigurationProvider(),
                    packageManager: this.getNodePackageManager(),
                    output: this.getOutput(),
                    // Check for updates every 6 hours
                    checkFrequency: LocalTime.MILLIS_PER_SECOND * LocalTime.SECONDS_PER_HOUR * 6,
                    // Abort if the update check takes longer than 500 milliseconds
                    checkTimeout: 500,
                }),
                configurationProvider: this.getCliConfigurationProvider(),
                deepLinkInstaller: update => this.deepLink({
                    operation: update ? 'optionally-update' : 'optionally-enable',
                }),
            }),
            {
                skipDeepLinkCheck: skip || input.skipDeepLinkCheck === true,
                skipUpdateCheck: skip || input.skipUpdateCheck === true,
            },
        );
    }

    public deepLink(input: DeepLinkInput): Promise<void> {
        return this.execute(
            new DeepLinkCommand({
                packageManager: this.getNodePackageManager(),
                protocolRegistryProvider: this.getProtocolRegistryProvider(),
                configurationProvider: this.getCliConfigurationProvider(),
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
                configurationProvider: this.getCliConfigurationProvider(),
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
        const {process} = this.configuration;

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
                    slot: new SlotForm({
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
            {
                ...input,
                organization: input.organization ?? process.getEnvValue('CROCT_ORGANIZATION') ?? undefined,
                workspace: input.workspace ?? process.getEnvValue('CROCT_WORKSPACE') ?? undefined,
                devApplication: input.devApplication ?? process.getEnvValue('CROCT_DEV_APPLICATION') ?? undefined,
                prodApplication: input.prodApplication ?? process.getEnvValue('CROCT_PROD_APPLICATION') ?? undefined,
                skipApiKeySetup: input.skipApiKeySetup ?? process.getEnvValue('CROCT_SKIP_API_KEY_SETUP') !== null,
            },
        );
    }

    public install(input: InstallInput): Promise<void> {
        // Force partial configuration when running non-interactively or in DND mode.
        // This skips prompts for missing project values and uses getters that throw errors
        // if those values are accessed — useful for CI where missing info will fail fast if needed.
        const partialConfiguration = !this.configuration.interactive || this.configuration.dnd;

        return this.execute(
            new InstallCommand({
                sdk: this.getSdk(),
                configurationManager: this.getConfigurationManager(),
                io: {
                    input: this.getInput(),
                    output: this.getOutput(),
                },
            }),
            {
                clean: input.clean ?? false,
                partialConfiguration: input.partialConfiguration ?? partialConfiguration,
            },
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

    public useTemplate(input: UseTemplateInput): Promise<void> {
        return this.execute(this.getUseTemplateCommand(), input);
    }

    public async getTemplateOptions(template: string): Promise<OptionMap> {
        const command = this.getUseTemplateCommand();
        const output = this.getOutput();

        const notifier = output.notify('Loading template options');

        try {
            return await command.getOptions(template);
        } finally {
            notifier.stop();
        }
    }

    private getUseTemplateCommand(): UseTemplateCommand {
        return new UseTemplateCommand({
            templateProvider: new ValidatedProvider({
                provider: new Json5Provider(this.getTemplateProvider()),
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

            if (this.configuration.dnd) {
                return new DefaultChoiceInput(input);
            }

            return input;
        });
    }

    private getNonInteractiveOutput(quiet = false): ConsoleOutput {
        const {configuration} = this;

        const output = new ConsoleOutput({
            output: configuration.process.getStandardOutput(),
            formatter: this.getLogFormatter(),
            interactive: false,
            quiet: quiet,
            onExit: () => configuration.process.exit(),
            linkOpener: new LazyLinkOpener((): LinkOpener => new ConsoleLinkOpener(output)),
        });

        configuration.process.on('exit', () => output.stop());

        return output;
    }

    private getHierarchicalLogger(): HierarchicalLogger {
        return this.share(this.getHierarchicalLogger, () => new TreeLogger(this.getLogger()));
    }

    private getLogger(): Logger {
        return this.share(this.getLogger, () => {
            const logger = new OutputLogger(this.getOutput());

            if (this.configuration.debug) {
                return logger;
            }

            return new FilteredLogger(logger, LogLevel.WARNING);
        });
    }

    private getOutput(): ConsoleOutput {
        return this.share(
            this.getOutput,
            () => {
                const {configuration} = this;

                const output = new ConsoleOutput({
                    output: configuration.process.getStandardOutput(),
                    formatter: this.getLogFormatter(),
                    interactive: this.configuration.interactive,
                    quiet: this.configuration.quiet,
                    onExit: () => configuration.process.exit(),
                    linkOpener: new LazyLinkOpener(
                        (): LinkOpener => {
                            const consoleOpener = new ConsoleLinkOpener(output);

                            if (this.configuration.dnd) {
                                // When DND mode is enabled, minimize interruptions
                                // by logging links to the console instead of opening them.
                                return consoleOpener;
                            }

                            return new BrowserLinkOpener(consoleOpener);
                        },
                    ),
                });

                configuration.process.on('exit', () => output.stop());

                return output;
            },
        );
    }

    private getLogFormatter(): LogFormatter {
        return this.share(this.getLogFormatter, () => new BoxenFormatter());
    }

    private getTemplateProvider(): ResourceProvider<string> {
        return this.share(this.getTemplateProvider, () => {
            const createMappedProvider = <T>(provider: ResourceProvider<T>): ResourceProvider<T> => (
                new MultiProvider({
                    providers: ['template.json5', 'template.json'].map(
                        fileName => new MappedProvider({
                            dataProvider: provider,
                            registryProvider: new ConstantProvider([
                                {
                                    pattern: /^(https:\/\/(?:www\.)?github.com\/[^/]+\/[^/]+)\/?$/,
                                    destination: `$1/blob/main/${fileName}`,
                                },
                                {
                                    // Any URL not ending with a file extension, excluding the trailing slash
                                    pattern: /^(.+?:\/*[^/]+(\/+[^/.]+|\/[^/]+(?=\/))*)\/*$/,
                                    destination: `$1/${fileName}`,
                                },
                            ]),
                        }),
                    ),
                })
            );

            const httpProvider = this.traceProvider({provider: this.getHttpProvider()});

            return this.traceProvider({
                label: 'TemplateProvider',
                provider: new CachedProvider({
                    resourceCache: new AutoSaveCache(new InMemoryCache()),
                    errorCache: new InMemoryCache(),
                    provider: new MultiProvider({
                        providers: [
                            new MappedProvider({
                                dataProvider: this.traceProvider({
                                    label: 'ResourceProvider',
                                    provider: createMappedProvider(
                                        new FileContentProvider(
                                            new MultiProvider({
                                                providers: [
                                                    this.traceProvider({
                                                        provider: this.createGitHubProvider(httpProvider),
                                                    }),
                                                    this.traceProvider({
                                                        provider: new HttpFileProvider(httpProvider),
                                                    }),
                                                ],
                                            }),
                                        ),
                                    ),
                                }),
                                registryProvider: this.traceProvider({
                                    label: 'NpmRegistryProvider',
                                    provider: new NpmRegistryProvider(
                                        new ValidatedProvider({
                                            provider: HttpResponseBody.json(
                                                this.traceProvider({
                                                    provider: this.getHttpProvider(),
                                                }),
                                            ),
                                            validator: new PartialNpmRegistryMetadataValidator(),
                                        }),
                                    ),
                                }),
                            }),
                            createMappedProvider(new FileContentProvider(this.getFileProvider())),
                        ],
                    }),
                }),
            });
        });
    }

    private getFileProvider(): ResourceProvider<FileSystemIterator> {
        return this.share(this.getFileProvider, () => {
            const httpProvider = this.traceProvider({provider: this.getHttpProvider()});
            const localSystemProvider = this.traceProvider({
                provider: new FileSystemProvider(
                    this.getFileSystem(),
                    this.getScanFilter(),
                ),
            });
            const fileProvider = new MultiProvider({
                providers: [
                    localSystemProvider,
                    this.traceProvider({
                        provider: this.createGitHubProvider(httpProvider),
                    }),
                    this.traceProvider({
                        provider: new HttpFileProvider(httpProvider),
                    }),
                ],
            });

            return this.traceProvider({
                label: 'FileProvider',
                provider: new MultiProvider({
                    providers: [
                        localSystemProvider,
                        this.traceProvider({
                            provider: new MappedProvider({
                                baseUrl: new URL('./', this.configuration.templateRegistryUrl),
                                dataProvider: this.traceProvider({
                                    label: 'ResourceProvider',
                                    provider: fileProvider,
                                }),
                                registryProvider: new SpecificResourceProvider({
                                    url: this.configuration.templateRegistryUrl,
                                    provider: this.traceProvider({
                                        label: 'GlobalRegistryProvider',
                                        provider: new CachedProvider({
                                            errorCache: new InMemoryCache(),
                                            resourceCache: new AutoSaveCache(new InMemoryCache()),
                                            provider: new ValidatedProvider({
                                                provider: new Json5Provider(new FileContentProvider(fileProvider)),
                                                validator: new RegistryValidator(),
                                            }),
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    ],
                }),
            });
        });
    }

    private createGitHubProvider(httpProvider: HttpProvider): ResourceProvider<FileSystemIterator> {
        // Cache busting
        const time = Date.now();

        return new GithubProvider({
            cache: new AutoSaveCache(new InMemoryCache()),
            provider: new MultiProvider({
                providers: [
                    new MultiProvider({
                        providers: [
                            new MappedProvider({
                                dataProvider: httpProvider,
                                registryProvider: new ConstantProvider([
                                    {
                                        // eslint-disable-next-line max-len -- Regex cannot be split
                                        pattern: /^https:\/\/raw\.github\.com\/croct-tech\/templates\/(HEAD|master)\/templates\/(.+)$/i,
                                        destination: `https://cdn.croct.io/templates/$2?c=${time}`,
                                    },
                                    {
                                        // eslint-disable-next-line max-len -- Regex cannot be split
                                        pattern: /^https:\/\/api\.github\.com\/repos\/croct-tech\/templates\/git\/trees\/(HEAD|master)\?recursive=true/i,
                                        destination: `https://cdn.croct.io/templates/git-tree.json?c=${time}`,
                                    },
                                ]),
                            }),
                            // If the file is not found in the CDN, fallback to the GitHub repository
                            httpProvider,
                        ],
                    }),
                    // If the URL is not the template repository, fallback to the GitHub server
                    httpProvider,
                ],
            }),
        });
    }

    private traceProvider<T>({provider, label}: ProviderTracingOptions<T>): ResourceProvider<T> {
        return new TraceProvider({
            label: label,
            provider: provider,
            logger: this.getHierarchicalLogger(),
        });
    }

    private getImportAction(): Action<ImportOptions> {
        return this.share(this.getImportAction, () => {
            const fileSystem = this.getFileSystem();
            const serverMap = new Map<string, Server>();

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
                        rootDirectory: this.initialDirectory,
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
                        serverFactory: this.getServerFactory(),
                        packageManager: this.getPackageManager(),
                        serverMap: serverMap,
                    }),
                    validator: new StartServerOptionsValidator(),
                }),
                'stop-server': new ValidatedAction({
                    action: new StopServer({
                        serverMap: serverMap,
                    }),
                    validator: new StopServerOptionsValidator(),
                }),
                'check-dependency': new ValidatedAction({
                    action: new CheckDependencyAction({
                        packageManager: this.getPackageManager(),
                    }),
                    validator: new CheckDependenciesOptionsValidator(),
                }),
                download: new ValidatedAction({
                    action: new DownloadAction({
                        fileSystem: fileSystem,
                        provider: this.getFileProvider(),
                        codemod: new PathBasedCodemod({
                            codemods: {
                                '**/*.{js,jsx,ts,tsx}': new ChainedCodemod(
                                    this.getNodeImportResolverCodemod(),
                                    new PathBasedCodemod({
                                        codemods: {
                                            '**/*.{js,jsx}': new ChainedCodemod(
                                                new FileCodemod({
                                                    fileSystem: fileSystem,
                                                    codemod: new JavaScriptCodemod({
                                                        codemod: new TypeErasureCodemod(),
                                                        languages: ['typescript', 'jsx'],
                                                    }),
                                                }),
                                            ),
                                        },
                                    }),
                                    new FormatCodemod(this.getJavaScriptFormatter()),
                                ),
                            },
                        }),
                    }),
                    validator: new DownloadOptionsValidator(),
                }),
                'resolve-import': new ValidatedAction({
                    action: new ResolveImportAction({
                        projectDirectory: this.workingDirectory,
                        fileSystem: fileSystem,
                        scanFilter: this.getScanFilter(),
                        codemod: new PathBasedCodemod({
                            codemods: {
                                '**/*.{js,jsx,ts,tsx}': new ChainedCodemod(
                                    this.getNodeImportResolverCodemod(),
                                    new FormatCodemod(this.getJavaScriptFormatter()),
                                ),
                            },
                        }),
                    }),
                    validator: new ResolveImportOptionsValidator(),
                }),
                install: new ValidatedAction({
                    action: new InstallAction({
                        packageManager: this.getPackageManager(),
                    }),
                    validator: new InstallOptionsValidator(),
                }),
                'add-dependency': new ValidatedAction({
                    action: new AddDependencyAction({
                        packageManager: this.getPackageManager(),
                    }),
                    validator: new AddDependencyOptionsValidator(),
                }),
                'execute-package': new ValidatedAction({
                    action: new ExecutePackage({
                        processObserver: this.configuration.process,
                        packageManager: this.getPackageManager(),
                        packageManagerProvider: this.getPackageManagerRegistry(),
                        workingDirectory: this.workingDirectory,
                        commandExecutor: this.getAsynchronousCommandExecutor(),
                        commandTimeout: 3 * 60 * 1000, // 3 minutes
                        sourceChecker: {
                            test: (url): boolean => url.protocol === 'file:'
                                || `${url}`.startsWith('https://github.com/croct-tech'),
                        },
                    }),
                    validator: new ExecutePackageOptionsValidator(),
                }),
                'locate-path': new ValidatedAction({
                    action: new LocatePathAction({
                        projectDirectory: this.workingDirectory,
                        fileSystem: fileSystem,
                        scanFilter: this.getScanFilter(),
                    }),
                    validator: new LocatePathOptionsValidator(),
                }),
                'move-path': new ValidatedAction({
                    action: new MovePathAction({
                        fileSystem: fileSystem,
                    }),
                    validator: new MovePathOptionsValidator(),
                }),
                'delete-path': new ValidatedAction({
                    action: new DeletePathAction({
                        fileSystem: fileSystem,
                    }),
                    validator: new DeletePathOptionsValidator(),
                }),
                'read-file': new ValidatedAction({
                    action: new ReadFileAction({
                        fileSystem: fileSystem,
                    }),
                    validator: new ReadFileOptionsValidator(),
                }),
                'write-file': new ValidatedAction({
                    action: new WriteFileAction({
                        fileSystem: fileSystem,
                        input: this.getInput(),
                    }),
                    validator: new WriteFileOptionsValidator(),
                }),
                'replace-file-content': new ValidatedAction({
                    action: new ReplaceFileContentAction({
                        fileSystem: fileSystem,
                    }),
                    validator: new ReplaceFileContentOptionsValidator(),
                }),
                'create-directory': new ValidatedAction({
                    action: new CreateDirectoryAction({
                        fileSystem: fileSystem,
                    }),
                    validator: new CreateDirectoryOptionsValidator(),
                }),
                'integrate-croct': new ValidatedAction({
                    action: new CallbackAction({
                        callback: async (): Promise<void> => {
                            const manager = this.getConfigurationManager();

                            if (!await manager.isInitialized(InitializationState.FULL)) {
                                return this.init({});
                            }
                        },
                    }),
                    validator: new IntegrateCroctOptionsValidator(),
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
                'create-api-key': new ValidatedAction({
                    action: new CreateApiKeyAction({
                        applicationApi: this.getApplicationApi(),
                        configurationManager: this.getConfigurationManager(),
                    }),
                    validator: new CreateApiKeyOptionsValidator(),
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
                                    templateProvider: this.getTemplateProvider(),
                                    fileProvider: new FileContentProvider(this.getFileProvider()),
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
        const getUrl = (path: string): string => new URL(path, this.configuration.adminUrl).toString();

        return {
            packageManager: LazyPromise.transient(() => {
                const manager = this.getPackageManager();

                return {
                    name: manager.getName(),
                };
            }),
            project: {
                features: LazyPromise.transient(async () => {
                    const {organization, workspace} = await this.getConfigurationManager().load();
                    const {features} = await this.getWorkspaceApi().getFeatures({
                        organizationSlug: organization,
                        workspaceSlug: workspace,
                    }) ?? {};

                    return features ?? {};
                }),
                quotas: LazyPromise.transient(async () => {
                    const {organization, workspace} = await this.getConfigurationManager().load();
                    const {quotas} = await this.getWorkspaceApi().getFeatures({
                        organizationSlug: organization,
                        workspaceSlug: workspace,
                    }) ?? {};

                    return quotas ?? {};
                }),
                organization: LazyPromise.transient(
                    async () => {
                        const {organization} = await this.getConfigurationManager().load();

                        return {
                            slug: organization,
                            url: getUrl(`organizations/${organization}`),
                        };
                    },
                ),
                workspace: LazyPromise.transient(
                    async () => {
                        const {organization, workspace} = await this.getConfigurationManager().load();

                        return {
                            slug: workspace,
                            url: getUrl(`organizations/${organization}/workspaces/${workspace}`),
                        };
                    },
                ),
                application: LazyPromise.transient(
                    async () => {
                        const {organization, workspace, applications} = await this.getConfigurationManager().load();
                        const path = `organizations/${organization}/workspaces/${workspace}/applications/`;
                        const prodApplication = applications.production;

                        return {
                            development: {
                                slug: applications.development,
                                url: getUrl(path + applications.development),
                                publicId: LazyPromise.transient(async () => {
                                    const workspaceApi = this.getWorkspaceApi();

                                    const application = await workspaceApi.getApplication({
                                        organizationSlug: organization,
                                        workspaceSlug: workspace,
                                        applicationSlug: applications.development,
                                    });

                                    if (application === null) {
                                        throw new EvaluationError('Development application not found.', {
                                            reason: ErrorReason.NOT_FOUND,
                                        });
                                    }

                                    return application.publicId;
                                }),
                            },
                            production: {
                                slug: applications.production,
                                url: getUrl(path + applications.production),
                                publicId:
                                prodApplication === undefined
                                    ? prodApplication
                                    : LazyPromise.transient(async () => {
                                        const workspaceApi = this.getWorkspaceApi();

                                        const application = await workspaceApi.getApplication({
                                            organizationSlug: organization,
                                            workspaceSlug: workspace,
                                            applicationSlug: prodApplication,
                                        });

                                        if (application === null) {
                                            throw new EvaluationError('Production application not found.', {
                                                reason: ErrorReason.NOT_FOUND,
                                            });
                                        }

                                        return application.publicId;
                                    }),
                            },
                        };
                    },
                ),
                path: LazyPromise.transient(async (): Promise<ProjectPaths> => {
                    const sdk = this.getSdk();
                    const configuration = await this.getConfigurationManager().load();

                    return sdk.getPaths(configuration);
                }),
                platform: LazyPromise.transient(async () => (await this.getPlatformProvider().get()) ?? 'unknown'),
                server: LazyPromise.transient(async (): Promise<{running: boolean, url?: string} | null> => {
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
        return this.share(
            this.getHttpProvider,
            () => new FetchProvider({
                retry: {
                    maxAttempts: 3,
                    delay: 1000,
                },
            }),
        );
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

            if (this.configuration.token !== undefined) {
                return new ProvidedTokenAuthenticator({
                    token: this.configuration.token,
                });
            }

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
                        listener: this.getTokenListener(),
                        tokenDuration: this.configuration.cliTokenDuration,
                        emailLinkGenerator: {
                            recovery: this.createEmailLinkGenerator(
                                this.configuration.emailSubject.passwordReset,
                            ),
                            verification: this.createEmailLinkGenerator(
                                this.configuration.emailSubject.accountActivation,
                            ),
                        },
                        verificationLinkDestination: {
                            accountActivation: this.configuration.verificationLinkDestination.accountActivation,
                            passwordReset: this.configuration.verificationLinkDestination.passwordReset,
                        },
                    }),
                    signUp: new SignUpForm({
                        input: input,
                        output: this.getOutput(),
                        userApi: this.getUserApi(true),
                        listener: this.getTokenListener(),
                        emailLinkGenerator: this.createEmailLinkGenerator(
                            this.configuration.emailSubject.accountActivation,
                        ),
                        verificationLinkDestination: this.configuration.verificationLinkDestination.accountActivation,
                    }),
                },
            });

            const api = this.getUserApi(true);

            const authenticator = new CachedAuthenticator({
                cacheKey: 'token',
                cacheProvider: new TokenCache({
                    clock: this.getClock(),
                    clockSkewTolerance: 5,
                    tokenFreshPeriod: this.configuration.cliTokenFreshPeriod,
                    tokenIssuer: () => api.issueToken({
                        duration: this.configuration.cliTokenDuration,
                    }),
                    cacheProvider: this.selectCacheProvider(
                        () => (
                            new FileSystemCache({
                                fileSystem: this.getFileSystem(),
                                directory: this.configuration.directories.config,
                                useKeyAsFileName: true,
                            })
                        ),
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

    private getSdkProvider(): Provider<Sdk | null> {
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
                    [Platform.JAVASCRIPT]: (): Sdk => new PlugJsSdk({
                        ...config,
                        bundlers: ['vite', 'parcel', 'tsup', 'rollup'],
                    }),
                    [Platform.REACT]: (): Sdk => new PlugReactSdk({
                        ...config,
                        importResolver: importResolver,
                        codemod: {
                            provider: new FormatCodemod(
                                formatter,
                                new FileCodemod({
                                    fileSystem: this.getFileSystem(),
                                    codemod: new JavaScriptCodemod({
                                        languages: ['typescript', 'jsx'],
                                        codemod: new JsxWrapperCodemod({
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
                                }),
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
                    [Platform.NEXTJS]: (): Sdk => {
                        const providerProps: Record<string, AttributeType> = {
                            appId: {
                                type: 'reference',
                                path: ['process', 'env', 'NEXT_PUBLIC_CROCT_APP_ID'],
                            },
                            debug: {
                                type: 'comparison',
                                operator: '===',
                                left: {
                                    type: 'reference',
                                    path: ['process', 'env', 'NEXT_PUBLIC_CROCT_DEBUG'],
                                },
                                right: {
                                    type: 'literal',
                                    value: 'true',
                                },
                            },
                        };

                        return new PlugNextSdk({
                            ...config,
                            userApi: this.getUserApi(),
                            applicationApi: this.getApplicationApi(),
                            importResolver: importResolver,
                            codemod: {
                                middleware: new FormatCodemod(
                                    formatter,
                                    new FileCodemod({
                                        fileSystem: this.getFileSystem(),
                                        codemod: new JavaScriptCodemod({
                                            languages: ['typescript', 'jsx'],
                                            codemod: new NextJsMiddlewareCodemod({
                                                // eslint-disable-next-line max-len -- Ignore for readability
                                                matcherPattern: '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
                                                import: {
                                                    module: '@croct/plug-next/middleware',
                                                    middlewareName: 'middleware',
                                                    middlewareFactoryName: 'withCroct',
                                                },
                                            }),
                                        }),
                                    }),
                                ),
                                appRouterProvider: new FormatCodemod(
                                    formatter,
                                    new FileCodemod({
                                        fileSystem: this.getFileSystem(),
                                        codemod: new JavaScriptCodemod({
                                            languages: ['typescript', 'jsx'],
                                            codemod: new JsxWrapperCodemod({
                                                fallbackToNamedExports: false,
                                                fallbackCodemod: new NextJsLayoutComponentCodemod({
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
                                    }),
                                ),
                                pageRouterProvider: new FormatCodemod(
                                    formatter,
                                    new FileCodemod({
                                        fileSystem: this.getFileSystem(),
                                        codemod: new JavaScriptCodemod({
                                            languages: ['typescript', 'jsx'],
                                            codemod: new JsxWrapperCodemod({
                                                fallbackToNamedExports: false,
                                                fallbackCodemod: new NextJsAppComponentCodemod({
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
                                    }),
                                ),
                                fallbackProvider: new FormatCodemod(
                                    formatter,
                                    new FileCodemod({
                                        fileSystem: this.getFileSystem(),
                                        codemod: new JavaScriptCodemod({
                                            languages: ['typescript', 'jsx'],
                                            codemod: new JsxWrapperCodemod({
                                                fallbackToNamedExports: false,
                                                fallbackCodemod: new NextJsAppComponentCodemod({
                                                    provider: {
                                                        component: 'CroctProvider',
                                                        module: '@croct/plug-react',
                                                        props: providerProps,
                                                    },
                                                }),
                                                wrapper: {
                                                    module: '@croct/plug-react',
                                                    component: 'CroctProvider',
                                                    props: providerProps,
                                                },
                                                targets: {
                                                    component: 'Component',
                                                },
                                            }),
                                        }),
                                    }),
                                ),
                            },
                        });
                    },
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

    private getNodePackageManagerProvider(): Provider<PackageManager | null> {
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
                    // Finally, try to detect the package manager by the presence of the executable
                    new ConditionalProvider({
                        candidates: (Object.entries(managers)).map(
                            ([name, manager]) => ({
                                value: manager,
                                condition: new ExecutableExists({
                                    executableLocator: this.getExecutableLocator(),
                                    command: name,
                                }),
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
                commandExecutor: this.getAsynchronousCommandExecutor(),
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

    private getNodeServerProvider(): Provider<Server> {
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

    private getServerFactory(): ServerFactory {
        return this.share(
            this.getServerFactory,
            () => new ProcessServerFactory({
                commandExecutor: this.getAsynchronousCommandExecutor(),
                workingDirectory: this.workingDirectory,
                startupTimeout: 60 * 1_000,
                startupCheckDelay: 1.5 * 1_000,
                lookupMaxPorts: 30,
                lookupTimeout: 2 * 1_000,
                processObserver: this.configuration.process,
            }),
        );
    }

    private getJavaScriptFormatter(): CodeFormatter {
        return this.share(
            this.getJavaScriptFormatter,
            () => new JavaScriptFormatter({
                commandExecutor: this.getAsynchronousCommandExecutor(),
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

    private getTsConfigLoader(): FileSystemTsConfigLoader {
        return this.share(
            this.getTsConfigLoader,
            () => new FileSystemTsConfigLoader({
                fileSystem: this.getFileSystem(),
                tsconfigValidator: new PartialTsconfigValidator(),
            }),
        );
    }

    private getAsynchronousCommandExecutor(): CommandExecutor {
        return this.share(
            this.getAsynchronousCommandExecutor,
            () => new ResolvedCommandExecutor({
                executableLocator: this.getExecutableLocator(),
                commandExecutor: this.getCommandExecutor(),
            }),
        );
    }

    private getSynchronousCommandExecutor(): SynchronousCommandExecutor {
        return this.getCommandExecutor();
    }

    private getCommandExecutor(): CommandExecutor & SynchronousCommandExecutor {
        return this.share(
            this.getCommandExecutor,
            () => new SpawnExecutor({
                currentDirectory: this.workingDirectory,
                windows: this.configuration
                    .process
                    .getPlatform() === 'win32',
            }),
        );
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

    private getPlatformProvider(): Provider<Platform | null> {
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
            const manager = new JsonConfigurationFileManager({
                fileSystem: this.getFileSystem(),
                fullValidator: new FullCroctConfigurationValidator(),
                partialValidator: new PartialCroctConfigurationValidator(),
                projectDirectory: this.workingDirectory,
            });

            return new IndexedConfigurationManager({
                workingDirectory: this.workingDirectory,
                configurationProvider: this.getCliConfigurationProvider(),
                manager: new CachedConfigurationManager(
                    this.isReadOnlyMode()
                        ? manager
                        : new NewConfigurationManager({
                            manager: manager,
                            initializer: {
                                initialize: () => this.init({}),
                            },
                        }),
                ),
            });
        });
    }

    private getNodeImportResolverCodemod(): Codemod<string> {
        return this.share(this.getNodeImportResolverCodemod, () => {
            const fileSystem = this.getFileSystem();
            const scanFilter = this.getScanFilter();

            return new GlobImportCodemod({
                fileSystem: fileSystem,
                rootPath: this.workingDirectory,
                filter: (path, depth) => depth <= 10 && scanFilter(path, depth),
                importResolver: this.getNodeImportResolver(),
                importCodemod: new FileCodemod({
                    fileSystem: fileSystem,
                    codemod: new JavaScriptCodemod({
                        languages: ['typescript', 'jsx'],
                        codemod: new JavaScriptImportCodemod(),
                    }),
                }),
                exportMatcher: {
                    test: (code, {names}): boolean => {
                        if (names.length === 0) {
                            return true;
                        }

                        return getExportedNames(code)
                            .some(name => names.includes(name));
                    },
                },
            });
        });
    }

    private getScanFilter(): ScanFilter {
        return this.share(this.getScanFilter, () => {
            const predicate = new MatchesGitignore({
                fileSystem: this.getFileSystem(),
                workingDirectory: this.workingDirectory,
            });

            return async path => !await predicate.test(path);
        });
    }

    private getUserApi(optionalAuthentication = false): UserApi {
        if (optionalAuthentication) {
            return new GraphqlUserApi(this.getGraphqlClient(true));
        }

        return this.share(this.getUserApi, () => new GraphqlUserApi(this.getGraphqlClient()));
    }

    private getOrganizationApi(): OrganizationApi {
        return this.share(
            this.getOrganizationApi,
            () => new GraphqlOrganizationApi(
                this.getGraphqlClient(),
                this.getHierarchyResolver(),
            ),
        );
    }

    private getWorkspaceApi(): WorkspaceApi {
        return this.share(
            this.getWorkspaceApi,
            () => new GraphqlWorkspaceApi(
                this.getGraphqlClient(),
                this.getHierarchyResolver(),
            ),
        );
    }

    private getApplicationApi(): ApplicationApi {
        return this.share(
            this.getApplicationApi,
            () => new GraphqlApplicationApi(
                this.getGraphqlClient(),
                this.getHierarchyResolver(),
            ),
        );
    }

    private getHierarchyResolver(): HierarchyResolver {
        return this.share(
            this.getHierarchyResolver,
            () => new HierarchyResolver(this.getGraphqlClient(), new InMemoryCache()),
        );
    }

    private getGraphqlClient(optionalAuthentication = false): GraphqlClient {
        if (optionalAuthentication) {
            return new FetchGraphqlClient({
                endpoint: this.configuration.adminGraphqlEndpoint,
                tokenProvider: {
                    getToken: () => this.getAuthenticator().getToken(),
                },
            });
        }

        return this.share(this.getGraphqlClient, () => {
            const authenticator = this.getAuthenticator();

            return new FetchGraphqlClient({
                endpoint: this.configuration.adminGraphqlEndpoint,
                tokenProvider: {
                    getToken: async () => (await authenticator.getToken())
                        ?? (authenticator.login({method: 'default'})),
                },
            });
        });
    }

    private getTokenListener(): AuthenticationListener {
        return this.share(
            this.getTokenListener,
            () => {
                const {configuration} = this;

                return new FocusListener({
                    platform: configuration.process.getPlatform(),
                    commandExecutor: this.getSynchronousCommandExecutor(),
                    timeout: 2_000,
                    listener: new SessionCloseListener({
                        api: this.getUserApi(true),
                        pollingInterval: 1_000,
                    }),
                });
            },
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

    private getProtocolRegistryProvider(): Provider<ProtocolRegistry | null> {
        return this.share(
            this.getProtocolRegistryProvider,
            () => new CallbackProvider(() => {
                const fileSystem = this.getFileSystem();
                const {process} = this.configuration;

                switch (process.getPlatform()) {
                    case 'darwin': {
                        const appDirectory = fileSystem.joinPaths(this.configuration.directories.data, 'apps');

                        // Firefox on macOS has a known bug that forces the user to select
                        // the application every time a URL is opened.
                        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=718422
                        // To work around this, configure the application in the Firefox profile.
                        // In addition, wrap the registry in a FailSafeRegistry to avoid errors
                        // if Firefox is not installed or if the profile directory cannot be located.
                        return new MacOsFirefoxRegistry({
                            output: this.getOutput(),
                            macOsRegistry: new MacOsRegistry({
                                fileSystem: fileSystem,
                                appDirectory: appDirectory,
                                commandExecutor: this.getAsynchronousCommandExecutor(),
                            }),
                            firefoxRegistry: FirefoxRegistry.macOs({
                                fileSystem: fileSystem,
                                homeDirectory: this.configuration.directories.home,
                                appPath: fileSystem.joinPaths(
                                    appDirectory,
                                    `${this.configuration.deepLinkProtocol}.app`,
                                ),
                            }),
                        });
                    }

                    case 'win32':
                        return new WindowsRegistry({
                            commandExecutor: this.getAsynchronousCommandExecutor(),
                        });

                    case 'linux':
                        return new LinuxRegistry({
                            fileSystem: fileSystem,
                            homeDirectory: this.configuration.directories.home,
                            commandExecutor: this.getAsynchronousCommandExecutor(),
                        });

                    default:
                        return null;
                }
            }),
        );
    }

    private selectCacheProvider<V>(factory: () => CacheProvider<string, V>): CacheProvider<string, V> {
        if (this.configuration.stateless) {
            return new InMemoryCache();
        }

        return factory();
    }

    private getCliConfigurationProvider(): CliConfigurationProvider {
        return this.share(this.getCliConfigurationProvider, () => {
            const fileSystem = this.getFileSystem();

            return new NormalizedConfigurationStore({
                fileSystem: fileSystem,
                configurationProvider: new CachedConfigurationStore({
                    cacheKey: 'config.json',
                    cache: this.selectCacheProvider(
                        () => new FileSystemCache({
                            fileSystem: fileSystem,
                            directory: this.configuration.directories.config,
                            useKeyAsFileName: true,
                        }),
                    ),
                    validator: new CliSettingsValidator(),
                }),
            });
        });
    }

    private async execute<I extends CommandInput>(command: Command<I>, input: I): Promise<void> {
        if (this.isReadOnlyMode() && !Cli.READ_ONLY_COMMANDS.has(command.constructor)) {
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

    private isReadOnlyMode(): boolean {
        return this.configuration.apiKey !== undefined;
    }

    private reportError(error: unknown): Promise<never> {
        const output = this.getOutput();

        output.report(Cli.handleError(error));

        return output.exit();
    }

    private static handleError(error: unknown): any {
        switch (true) {
            case error instanceof ResourceProviderError:
                return new HelpfulError(
                    error.message,
                    {
                        ...error.help,
                        details: [
                            `URL: ${error.url}`,
                            ...(error.help.details ?? []),
                        ],
                    },
                );

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

            case error instanceof ActionError:
                if (error.tracing.length > 0) {
                    const trace = error.tracing
                        .map(({name, source}, index) => {
                            const location = source !== undefined
                                ? ` at ${Cli.getSourceLocation(source)}`
                                : '';

                            return `${' '.repeat(index + 1)}↳ \`${name}\`${location}`;
                        })
                        .join('\n');

                    return new HelpfulError(`${error.message}\n\n▶️ **Trace**\n${trace}`, error.help);
                }

                break;

            case error instanceof ProjectConfigurationError:
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

    private static getSourceLocation(source: SourceLocation): string {
        if (source.url.protocol === 'file:') {
            return `${source.url}:${source.start.line}:${source.start.column}`;
        }

        if (source.url.hostname === 'github.com') {
            return `${source.url}#L${source.start.line}-L${source.end.line}`;
        }

        return `${source.url}#${source.start.line}:${source.start.column}-${source.end.line}:${source.end.column}`;
    }
}
