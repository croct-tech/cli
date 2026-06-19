import type {Installation, InstallationPlan, Sdk, UpdateOptions} from '@/application/project/sdk/sdk';
import {SdkError} from '@/application/project/sdk/sdk';
import type {ProjectConfiguration, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import type {Task, TaskNotifier} from '@/application/cli/io/output';
import type {PackageManager} from '@/application/project/packageManager/packageManager';
import type {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import type {FileSystem} from '@/application/fs/fileSystem';
import type {CodeFormatter} from '@/application/project/code/formatting/formatter';
import type {ExampleFile} from '@/application/project/code/generation/example';
import {CodeLanguage} from '@/application/project/code/generation/example';
import type {Slot} from '@/application/model/slot';
import type {WorkspaceApi} from '@/application/api/workspace';
import {TargetSdk} from '@/application/api/workspace';
import type {UserApi} from '@/application/api/user';
import type {ApplicationApi, GeneratedApiKey} from '@/application/api/application';
import type {ContentLoader} from '@/application/project/sdk/content/contentLoader';
import {EnvFile} from '@/application/project/code/envFile';
import {ApiKeyPermission} from '@/application/model/application';
import {ApiError} from '@/application/api/error';
import {ErrorReason, HelpfulError} from '@/application/error';
import {TaskProgressLogger} from '@/infrastructure/application/cli/io/taskProgressLogger';
import type {CommandExecutor} from '@/application/system/process/executor';
import type {Codemod} from '@/application/project/code/transformation/codemod';
import type {NeonListOptions} from '@/application/project/code/transformation/neon/neonListCodemod';
import type {ExampleLauncher} from '@/application/project/example/exampleLauncher';
import type {Example} from '@/application/project/example/example';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    packageManager: PackageManager,
    fileSystem: FileSystem,
    formatter: CodeFormatter,
    commandExecutor: CommandExecutor,
    exampleLauncher: ExampleLauncher,
    contentLoader: ContentLoader,
    workspaceApi: WorkspaceApi,
    userApi: UserApi,
    applicationApi: ApplicationApi,
    phpstanIncludeCodemod: Codemod<string, NeonListOptions>,
};

export enum PhpEnvVar {
    API_KEY = 'CROCT_API_KEY',
    APP_ID = 'CROCT_APP_ID',
}

/**
 * An optional Croct integration installed when a companion library is already present.
 */
type Integration = {
    detect: string,
    install: string,
};

/**
 * Base SDK for PHP projects.
 *
 * Installs the Croct dependencies through Composer and writes the credentials
 * to the project's `.env` file. Framework-specific subclasses extend the
 * installation plan with their own registration and example-generation steps.
 */
export abstract class PhpSdk implements Sdk {
    private static readonly PHPSTAN_EXTENSION = 'vendor/croct/plug-php/extension.neon';

    private static readonly INTEGRATIONS: readonly Integration[] = [
        {
            detect: 'storyblok/php-content-api-client',
            install: 'croct/plug-storyblok',
        },
    ];

    protected readonly projectDirectory: WorkingDirectory;

    protected readonly packageManager: PackageManager;

    protected readonly fileSystem: FileSystem;

    protected readonly formatter: CodeFormatter;

    protected readonly commandExecutor: CommandExecutor;

    protected readonly exampleLauncher: ExampleLauncher;

    private readonly phpstanIncludeCodemod: Codemod<string, NeonListOptions>;

    private readonly contentLoader: ContentLoader;

    private readonly workspaceApi: WorkspaceApi;

    private readonly userApi: UserApi;

    private readonly applicationApi: ApplicationApi;

    public constructor(configuration: Configuration) {
        this.projectDirectory = configuration.projectDirectory;
        this.packageManager = configuration.packageManager;
        this.fileSystem = configuration.fileSystem;
        this.formatter = configuration.formatter;
        this.commandExecutor = configuration.commandExecutor;
        this.exampleLauncher = configuration.exampleLauncher;
        this.phpstanIncludeCodemod = configuration.phpstanIncludeCodemod;
        this.contentLoader = configuration.contentLoader;
        this.workspaceApi = configuration.workspaceApi;
        this.userApi = configuration.userApi;
        this.applicationApi = configuration.applicationApi;
    }

    public async setup(installation: Installation): Promise<ProjectConfiguration> {
        const {input, output} = installation;

        const plan = await this.getInstallationPlan(installation);

        const dependencies = [...plan.dependencies, ...await this.getIntegrationDependencies()];

        const configuration: ProjectConfiguration = {
            ...plan.configuration,
            paths: {
                content: '.',
                ...await this.getPaths(installation.configuration),
                ...plan.configuration.paths,
            },
        };

        const resolvedInstallation: Installation = {
            ...installation,
            configuration: {
                ...installation.configuration,
                ...configuration,
                applications: installation.configuration.applications,
            },
        };

        const tasks: Task[] = [];

        tasks.push({
            title: 'Install dependencies',
            task: async notifier => {
                notifier.update('Installing dependencies');

                const logger = new TaskProgressLogger({
                    status: 'Installing dependencies',
                    notifier: notifier,
                });

                try {
                    await this.packageManager.addDependencies(dependencies, {logger: logger});

                    notifier.confirm('Dependencies installed');
                } catch (error) {
                    notifier.alert('Failed to install dependencies', HelpfulError.formatMessage(error));
                }
            },
        });

        tasks.push(...plan.tasks);

        const usesPhpstan = await this.packageManager.hasDependency('phpstan/phpstan');
        const usesExtensionInstaller = await this.packageManager.hasDependency('phpstan/extension-installer');

        if (usesPhpstan && !usesExtensionInstaller) {
            // PHPStan auto-discovers the extension when phpstan/extension-installer is present;
            // otherwise the extension must be added to the configuration manually.
            tasks.push(this.getPhpstanTask());
        }

        if (await this.packageManager.hasDependency('vimeo/psalm')) {
            tasks.push(this.getPsalmTask());
        }

        tasks.push({
            title: 'Set up credentials',
            task: async notifier => {
                notifier.update('Setting up credentials');

                try {
                    await this.setUpCredentials({
                        ...resolvedInstallation,
                        notifier: notifier,
                    });

                    notifier.confirm('Credentials configured');
                } catch (error) {
                    notifier.alert('Failed to set up credentials', HelpfulError.formatMessage(error));
                }
            },
        });

        tasks.push({
            title: 'Download content',
            task: async notifier => {
                notifier.update('Downloading content');

                try {
                    await this.contentLoader.downloadContent(resolvedInstallation.configuration, true);

                    notifier.confirm('Content downloaded');
                } catch (error) {
                    notifier.alert('Failed to download content', HelpfulError.formatMessage(error));
                }
            },
        });

        tasks.push({
            title: 'Generate types',
            task: async notifier => {
                notifier.update('Generating types');

                try {
                    await this.updateTypes(resolvedInstallation, {clean: true});

                    notifier.confirm('Types generated');
                } catch (error) {
                    notifier.alert('Failed to generate types', HelpfulError.formatMessage(error));
                }
            },
        });

        if (input !== undefined) {
            output.break();
            output.inform('**Installation plan**');

            for (const {title} of tasks) {
                output.log(` - ${title}`);
            }

            output.break();

            if (!await input.confirm({message: 'Proceed?', default: true})) {
                return output.exit();
            }
        }

        await output.monitor({tasks: tasks});

        return configuration;
    }

    public getPaths(configuration: ProjectConfiguration): Promise<ProjectPaths> {
        const source = configuration.paths?.source ?? 'src';

        return Promise.resolve({
            ...configuration.paths,
            source: source,
            utilities: configuration.paths?.utilities ?? `${source}/utils`,
            components: configuration.paths?.components ?? `${source}/components`,
            examples: configuration.paths?.examples ?? 'examples',
        });
    }

    public async update(installation: Installation, options: UpdateOptions = {}): Promise<void> {
        await this.contentLoader.downloadContent(installation.configuration, options.clean === true);
        await this.updateTypes(installation, options);
    }

    private async updateTypes(installation: Installation, options: UpdateOptions): Promise<void> {
        const {configuration} = installation;
        // The `.stub` extension keeps PHPStan/Psalm from analysing the file as source
        // (which would clash with the real Plug interface); the plug-php extension and
        // Psalm plugin load it only as a type overlay.
        const stubPath = this.fileSystem.joinPaths(
            this.projectDirectory.get(),
            configuration.paths?.content ?? '.',
            'slots.stub',
        );

        // The stub is committed, so it is regenerated only on a clean install or when missing.
        if (options.clean !== true && await this.fileSystem.exists(stubPath)) {
            return;
        }

        if (Object.keys(configuration.slots).length === 0 && Object.keys(configuration.components).length === 0) {
            return;
        }

        const source = await this.contentLoader.loadTypes(configuration, TargetSdk.PHP);

        await this.fileSystem.createDirectory(this.fileSystem.getDirectoryName(stubPath), {recursive: true});
        await this.fileSystem.writeTextFile(stubPath, source, {overwrite: true});
    }

    public async generateSlotExample(slot: Slot, installation: Installation): Promise<void> {
        const rootPath = this.projectDirectory.get();
        const phpFiles: string[] = [];

        for (const file of await this.generateSlotExampleFiles(slot, installation)) {
            const directory = this.fileSystem.joinPaths(rootPath, this.fileSystem.getDirectoryName(file.path));

            await this.fileSystem
                .createDirectory(directory, {recursive: true})
                .catch(() => null);

            const filePath = this.fileSystem.joinPaths(rootPath, file.path);

            await this.fileSystem.writeTextFile(filePath, file.code, {overwrite: true});

            if (file.language === CodeLanguage.PHP) {
                phpFiles.push(filePath);
            }
        }

        if (phpFiles.length > 0) {
            await this.formatter.format(phpFiles);
        }
    }

    public async presentExamples(slots: Slot[], installation: Installation): Promise<void> {
        await this.exampleLauncher.launch({
            examples: await Promise.all(slots.map(slot => this.createExample(slot, installation))),
            input: installation.input,
            output: installation.output,
        });
    }

    /**
     * Resolves the optional integration dependencies enabled by libraries already in the project.
     *
     * Merged into the installation plan automatically; subclasses without transparent
     * auto-decoration override this to opt out.
     */
    protected async getIntegrationDependencies(): Promise<string[]> {
        const detected = await Promise.all(
            PhpSdk.INTEGRATIONS.map(integration => this.packageManager.hasDependency(integration.detect)),
        );

        return PhpSdk.INTEGRATIONS
            .filter((_, index) => detected[index])
            .map(integration => integration.install);
    }

    protected abstract getInstallationPlan(installation: Installation): Promise<InstallationPlan>;

    protected abstract generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]>;

    /**
     * Builds the object describing where the generated example for a slot is reached.
     *
     * Each SDK derives this from the same configured paths it generates the example with.
     */
    protected abstract createExample(slot: Slot, installation: Installation): Promise<Example>;

    private getPhpstanTask(): Task {
        const instruction = `Add \`${PhpSdk.PHPSTAN_EXTENSION}\` to your PHPStan \`includes\`.`;

        return {
            title: 'Enable PHPStan extension',
            task: async notifier => {
                notifier.update('Enabling PHPStan extension');

                // PHPStan runs without a config file, so create one when absent: a file
                // with only `includes` is valid and loads the extension.
                const path = await this.findPhpstanConfig()
                    ?? this.fileSystem.joinPaths(this.projectDirectory.get(), 'phpstan.neon');

                try {
                    const {modified} = await this.phpstanIncludeCodemod.apply(path, {
                        key: 'includes',
                        value: PhpSdk.PHPSTAN_EXTENSION,
                    });

                    notifier.confirm(modified ? 'PHPStan extension enabled' : 'PHPStan extension already enabled');
                } catch {
                    notifier.warn('Failed to enable the PHPStan extension', instruction);
                }
            },
        };
    }

    private getPsalmTask(): Task {
        const instruction = 'Run `vendor/bin/psalm-plugin enable croct/plug-php` to enable the Croct plugin.';

        return {
            title: 'Enable Psalm plugin',
            task: async notifier => {
                notifier.update('Enabling Psalm plugin');

                try {
                    const command = await this.packageManager.getPackageCommand(
                        'psalm-plugin',
                        ['enable', 'croct/plug-php'],
                    );

                    const execution = await this.commandExecutor.run(command, {
                        workingDirectory: this.projectDirectory.get(),
                    });

                    const exitCode = await execution.wait();

                    if (exitCode === 0 || exitCode === 3) {
                        // Psalm's enable command returns 0 when it enables
                        // the plugin and 3 when it was already enabled.
                        notifier.confirm('Psalm plugin enabled');
                    } else {
                        notifier.warn('Failed to enable the Psalm plugin', instruction);
                    }
                } catch {
                    notifier.warn('Failed to enable the Psalm plugin', instruction);
                }
            },
        };
    }

    private async findPhpstanConfig(): Promise<string | null> {
        const root = this.projectDirectory.get();
        const paths = ['phpstan.neon', 'phpstan.neon.dist', 'phpstan.dist.neon']
            .map(name => this.fileSystem.joinPaths(root, name));

        const existing = await Promise.all(paths.map(path => this.fileSystem.exists(path)));

        for (let index = 0; index < existing.length; index++) {
            if (existing[index]) {
                return paths[index];
            }
        }

        return null;
    }

    protected async setUpCredentials(installation: Installation & {notifier: TaskNotifier}): Promise<void> {
        const {configuration, notifier} = installation;

        notifier.update('Loading information');

        const developmentApplication = await this.workspaceApi.getApplication({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            applicationSlug: configuration.applications.development,
        });

        if (developmentApplication === null) {
            throw new SdkError(
                `Development application \`${configuration.applications.development}\` not found.`,
                {reason: ErrorReason.NOT_FOUND},
            );
        }

        if (!await this.hasApiKey() && installation.skipApiKeySetup !== true) {
            const user = await this.userApi.getUser();

            notifier.update('Creating API key');

            let apiKey: GeneratedApiKey;

            try {
                apiKey = await this.applicationApi.createApiKey({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    applicationSlug: developmentApplication.slug,
                    name: `${user.username} CLI`,
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

            await this.storeApiKey(apiKey.secret);
        }

        await this.storeAppId(developmentApplication.publicId);
    }

    /**
     * Reports whether the API key credential is already present.
     */
    protected hasApiKey(): Promise<boolean> {
        return this.getEnvFile().hasVariable(PhpEnvVar.API_KEY);
    }

    /**
     * Persists the API key credential.
     */
    protected async storeApiKey(secret: string): Promise<void> {
        await this.getEnvFile().setVariables({[PhpEnvVar.API_KEY]: secret});
    }

    /**
     * Persists the application ID credential.
     */
    protected async storeAppId(publicId: string): Promise<void> {
        await this.getEnvFile().setVariables({[PhpEnvVar.APP_ID]: publicId});
    }

    private getEnvFile(): EnvFile {
        return new EnvFile(this.fileSystem, this.fileSystem.joinPaths(this.projectDirectory.get(), '.env'));
    }
}
