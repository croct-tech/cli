import type {Installation} from '@/application/project/sdk/sdk';
import {SdkError} from '@/application/project/sdk/sdk';
import type {
    Configuration as JavaScriptSdkConfiguration,
    InstallationPlan,
} from '@/application/project/sdk/javasScriptSdk';
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
import {ApiKeyPermission} from '@/application/model/application';
import type {CommandExecutor} from '@/application/system/process/executor';

type CodemodConfiguration = {
    config: Codemod<string>,
};

export type Configuration = JavaScriptSdkConfiguration & {
    codemod: CodemodConfiguration,
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
    private readonly userApi: UserApi;

    private readonly applicationApi: ApplicationApi;

    private readonly codemod: CodemodConfiguration;

    private readonly commandExecutor: CommandExecutor;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.codemod = configuration.codemod;
        this.userApi = configuration.userApi;
        this.applicationApi = configuration.applicationApi;
        this.commandExecutor = configuration.commandExecutor;
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const isTypeScript = await this.isTypeScriptProject();

        const paths = await this.getPaths(installation.configuration);
        const slotPath = this.fileSystem.joinPaths(paths.components, '%slug%.vue');
        const pagePath = this.fileSystem.joinPaths(paths.examples, '%slug%', 'index.vue');

        const generator = new PlugNuxtExampleGenerator({
            typescript: isTypeScript,
            contentVariable: 'data.content',
            slotImportPath: this.fileSystem.joinPaths('~', paths.components, '%slug%.vue'),
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
            configuration: {
                ...configuration,
                paths: {
                    ...configuration.paths,
                    examples: 'pages',
                },
            },
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
        return this.locateFile(
            ...['ts', 'js', 'mjs'].map(ext => `nuxt.config.${ext}`),
        );
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
                    } catch (error) {
                        notifier.alert('Failed to register module', HelpfulError.formatMessage(error));
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
