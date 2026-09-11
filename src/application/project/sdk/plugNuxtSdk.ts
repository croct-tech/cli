import type {Installation, InstallationPlan} from '@/application/project/sdk/sdk';
import {SdkError} from '@/application/project/sdk/sdk';
import type {Configuration as JavaScriptSdkConfiguration} from '@/application/project/sdk/javasScriptSdk';
import {JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import type {ApplicationApi, GeneratedApiKey} from '@/application/api/application';
import type {WorkspaceApi} from '@/application/api/workspace';
import {EnvFile} from '@/application/project/code/envFile';
import type {UserApi} from '@/application/api/user';
import type {Codemod} from '@/application/project/code/transformation/codemod';
import type {Task, TaskNotifier} from '@/application/cli/io/output';
import type {ExampleFile} from '@/application/project/code/generation/example';
import {PlugNuxtExampleGenerator} from '@/application/project/code/generation/slot/plugNuxtExampleGenerator';
import {ApiError} from '@/application/api/error';
import type {Slot} from '@/application/model/slot';
import {ErrorReason, HelpfulError} from '@/application/error';
import type {Example} from '@/application/project/example/example';
import {UrlExample} from '@/application/project/example/example';
import {ApiKeyPermission} from '@/application/model/application';
import type {CommandExecutor} from '@/application/system/process/executor';
import type {ProjectConfiguration, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import type {
    NuxtConfig,
    NuxtConfigParser,
} from '@/application/project/code/transformation/javascript/nuxtConfigParser';

type CodemodConfiguration = {
    config: Codemod<string>,
};

export type Configuration = JavaScriptSdkConfiguration & {
    codemod: CodemodConfiguration,
    configParser: NuxtConfigParser,
    userApi: UserApi,
    workspaceApi: WorkspaceApi,
    applicationApi: ApplicationApi,
    commandExecutor: CommandExecutor,
};

type NuxtProjectInfo = {
    typescript: boolean,
    config: {
        file: string,
    },
    envFile: EnvFile,
};

type NuxtInstallation = Installation & {
    project: NuxtProjectInfo,
    notifier: TaskNotifier,
};

enum NuxtEnvVar {
    API_KEY = 'NUXT_CROCT_API_KEY',
    APP_ID = 'NUXT_PUBLIC_CROCT_APP_ID',
}

export class PlugNuxtSdk extends JavaScriptSdk {
    private static readonly CONFIG_FILES = ['ts', 'js', 'mjs'].map(extension => `nuxt.config.${extension}`);

    private readonly userApi: UserApi;

    private readonly applicationApi: ApplicationApi;

    private readonly codemod: CodemodConfiguration;

    private readonly configParser: NuxtConfigParser;

    private readonly commandExecutor: CommandExecutor;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.codemod = configuration.codemod;
        this.configParser = configuration.configParser;
        this.userApi = configuration.userApi;
        this.applicationApi = configuration.applicationApi;
        this.commandExecutor = configuration.commandExecutor;
    }

    public async getPaths(configuration: ProjectConfiguration): Promise<ProjectPaths> {
        const source = configuration.paths?.source ?? await this.getSourceDirectory();

        return super.getPaths({
            ...configuration,
            paths: {
                ...configuration.paths,
                source: source,
                // Examples are pages, which Nuxt routes automatically
                examples: configuration.paths?.examples ?? this.fileSystem.joinPaths(source, 'pages'),
            },
        });
    }

    protected createExample(slot: Slot): Promise<Example> {
        // Nuxt auto-routes `pages/<slug>/index.vue` to `/<slug>`.
        return Promise.resolve(new UrlExample(slot.name, `/${slot.slug}`));
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const isTypeScript = await this.isTypeScriptProject();

        const paths = await this.getPaths(installation.configuration);
        const slotPath = this.fileSystem.joinPaths(paths.components, '%slug%.vue');
        const pagePath = this.fileSystem.joinPaths(paths.examples, '%slug%', 'index.vue');

        const generator = new PlugNuxtExampleGenerator({
            typescript: isTypeScript,
            contentVariable: 'data.content',
            // Nuxt resolves `~` to the source directory
            slotImportPath: this.fileSystem.joinPaths(
                '~',
                this.fileSystem.getRelativePath(paths.source, paths.components),
                '%slug%.vue',
            ),
            slotFilePath: slotPath,
            slotComponentName: '%name%',
            pageFilePath: pagePath,
        });

        const example = generator.generate({
            id: slot.slug,
            version: slot.version.major,
            definition: slot.resolvedDefinition,
        });

        return example.files;
    }

    protected async getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        const {configuration} = installation;
        const projectInfo = await this.getProjectInfo();

        return {
            dependencies: ['@croct/plug-nuxt'],
            tasks: this.getInstallationTasks({
                ...installation,
                project: projectInfo,
            }),
            configuration: configuration,
        };
    }

    private async getProjectInfo(): Promise<NuxtProjectInfo> {
        const [isTypescript, configFile] = await Promise.all([
            this.isTypeScriptProject(),
            this.locateNuxtConfig(),
        ]);

        const projectDirectory = this.projectDirectory.get();
        const extension = isTypescript ? 'ts' : 'js';

        return {
            typescript: isTypescript,
            config: {
                file: configFile ?? `nuxt.config.${extension}`,
            },
            envFile: new EnvFile(
                this.fileSystem,
                this.fileSystem.joinPaths(projectDirectory, '.env'),
            ),
        };
    }

    private async locateNuxtConfig(): Promise<string | null> {
        return this.locateFile(...PlugNuxtSdk.CONFIG_FILES);
    }

    private async getConfig(): Promise<NuxtConfig> {
        const source = await this.readFile(...PlugNuxtSdk.CONFIG_FILES).catch(() => null);

        return source === null ? {} : this.configParser.parse(source);
    }

    /**
     * Resolves the source directory following the rules Nuxt applies to `srcDir`.
     *
     * Unless configured otherwise, Nuxt 4, and Nuxt 3 opted into the version 4
     * behavior, use `app/` as the source directory, falling back to the root
     * directory for projects that still follow the previous layout.
     */
    private async getSourceDirectory(): Promise<string> {
        const [config, isNuxt4] = await Promise.all([
            this.getConfig(),
            // Includes the 4.0 pre-releases
            this.packageManager.hasDirectDependency('nuxt', '>=4.0.0-0'),
        ]);

        if (config.srcDir !== undefined) {
            const root = this.projectDirectory.get();
            const directory = this.fileSystem.getRelativePath(root, this.fileSystem.joinPaths(root, config.srcDir));

            return directory === '' ? '.' : directory;
        }

        if (!isNuxt4 && config.future?.compatibilityVersion !== 4) {
            return '.';
        }

        return await this.usesAppDirectory() ? 'app' : '.';
    }

    private async usesAppDirectory(): Promise<boolean> {
        const directory = this.fileSystem.joinPaths(this.projectDirectory.get(), 'app');

        if (!await this.fileSystem.isDirectory(directory)) {
            return false;
        }

        for await (const entry of this.fileSystem.list(directory, (_, depth) => depth === 0)) {
            // Nuxt 3 already kept these files in `app/`, so they do not indicate the new layout
            if (entry.name !== 'spa-loading-template.html' && !entry.name.startsWith('router.options')) {
                return true;
            }
        }

        // Otherwise, `app/` is the source directory unless the root follows the previous layout
        const rootLayoutEntry = await this.locateFile(
            'app.vue',
            'App.vue',
            'assets',
            'layouts',
            'middleware',
            'pages',
            'plugins',
        );

        return rootLayoutEntry === null;
    }

    private getInstallationTasks(installation: Omit<NuxtInstallation, 'notifier'>): Task[] {
        return [
            {
                title: 'Register module',
                task: async notifier => {
                    notifier.update('Registering module');

                    try {
                        await this.applyConfigCodemod(installation.project.config.file);

                        notifier.confirm('Module registered');
                    } catch {
                        notifier.alert(
                            'Failed to register module',
                            'Add \'@croct/plug-nuxt\' to the modules array in your nuxt.config.',
                        );
                    }
                },
            },
            {
                title: 'Generate Nuxt type aliases',
                task: async notifier => {
                    notifier.update('Generating Nuxt type aliases');

                    try {
                        await this.generateNuxtTypeAliases();

                        notifier.confirm('Nuxt type aliases generated');
                    } catch (error) {
                        notifier.alert('Failed to generate Nuxt type aliases', HelpfulError.formatMessage(error));
                    }
                },
            },
            {
                title: 'Setup environment variables',
                task: async notifier => {
                    notifier.update('Setting up environment variables');

                    try {
                        await this.updateEnvVariables({
                            ...installation,
                            notifier: notifier,
                        });

                        notifier.confirm('Environment variables updated');
                    } catch (error) {
                        notifier.alert('Failed to update environment variables', HelpfulError.formatMessage(error));
                    }
                },
            },
        ];
    }

    private async applyConfigCodemod(file: string): Promise<void> {
        await this.codemod
            .config
            .apply(this.fileSystem.joinPaths(this.projectDirectory.get(), file));
    }

    private async generateNuxtTypeAliases(): Promise<void> {
        const command = await this.packageManager.getPackageCommand('nuxi', ['prepare']);

        const execution = await this.commandExecutor.run(command, {
            workingDirectory: this.projectDirectory.get(),
        });

        if (await execution.wait() !== 0) {
            throw new HelpfulError(`Failed to execute command \`${command.name}\`.`);
        }
    }

    private async updateEnvVariables(installation: NuxtInstallation): Promise<void> {
        const {project: {envFile}, configuration, notifier} = installation;

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

        if (!await envFile.hasVariable(NuxtEnvVar.API_KEY) && installation.skipApiKeySetup !== true) {
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

            await envFile.setVariables({
                [NuxtEnvVar.API_KEY]: apiKey.secret,
            });
        }

        await envFile.setVariables({
            [NuxtEnvVar.APP_ID]: developmentApplication.publicId,
        });
    }
}
