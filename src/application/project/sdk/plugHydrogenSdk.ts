import type {Installation, InstallationPlan} from '@/application/project/sdk/sdk';
import {SdkError} from '@/application/project/sdk/sdk';
import type {Configuration as JavaScriptSdkConfiguration} from '@/application/project/sdk/javasScriptSdk';
import {JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import type {ProjectConfiguration, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import type {Example} from '@/application/project/example/example';
import {UrlExample} from '@/application/project/example/example';
import type {Codemod, CodemodOptions} from '@/application/project/code/transformation/codemod';
import type {WrapperOptions} from '@/application/project/code/transformation/javascript/jsxWrapperCodemod';
import type {Task} from '@/application/cli/io/output';
import {EnvFile} from '@/application/project/code/envFile';
import type {ExampleFile} from '@/application/project/code/generation/example';
import {HydrogenExampleGenerator} from '@/application/project/code/generation/slot/hydrogenExampleGenerator';
import type {Slot} from '@/application/model/slot';
import {ErrorReason, HelpfulError} from '@/application/error';
import type {UserApi} from '@/application/api/user';
import type {ApplicationApi, GeneratedApiKey} from '@/application/api/application';
import {ApiKeyPermission} from '@/application/model/application';
import {ApiError} from '@/application/api/error';

/**
 * The Hydrogen era. The boundary is `@shopify/hydrogen@2025.5.0`, where the skeleton migrated from
 * Remix to React Router 7.
 */
type Era = 'react-router' | 'remix';

type CodemodConfiguration = {
    /**
     * Registers the `croct()` Vite plugin in `vite.config.ts`.
     */
    vite: Codemod<string>,

    /**
     * Wraps the app with `<CroctProvider>` inside `<Analytics.Provider>` in `app/root.tsx`.
     */
    provider: Codemod<string, WrapperOptions>,

    /**
     * Registers the Croct middleware in `app/root.tsx` (React Router 7 only).
     */
    middleware: Codemod<string>,

    /**
     * Exposes the Croct context on the load context in `app/lib/context.ts` (Remix only).
     */
    context: Codemod<string>,

    /**
     * Writes the Croct cookies after the session commit in `server.ts`.
     */
    cookies: Codemod<string>,

    /**
     * Allows the Croct origin in the CSP in `app/entry.server.tsx`.
     */
    csp: Codemod<string>,
};

export type Configuration = JavaScriptSdkConfiguration & {
    codemod: CodemodConfiguration,
    userApi: UserApi,
    applicationApi: ApplicationApi,
};

enum HydrogenEnvVar {
    API_KEY = 'CROCT_API_KEY',
    APP_ID = 'PUBLIC_CROCT_APP_ID',
}

type HydrogenProjectInfo = {
    era: Era,
    viteConfig: string | null,
    server: string | null,
    root: string | null,
    context: string | null,
    entryServer: string | null,
    envFile: EnvFile,
};

type HydrogenInstallation = Installation & {
    project: HydrogenProjectInfo,
};

export class PlugHydrogenSdk extends JavaScriptSdk {
    private readonly codemod: CodemodConfiguration;

    private readonly userApi: UserApi;

    private readonly applicationApi: ApplicationApi;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.codemod = configuration.codemod;
        this.userApi = configuration.userApi;
        this.applicationApi = configuration.applicationApi;
    }

    public getPaths(configuration: ProjectConfiguration): Promise<ProjectPaths> {
        return Promise.resolve({
            ...configuration.paths,
            source: configuration.paths?.source ?? 'app',
            utilities: configuration.paths?.utilities ?? 'app/lib',
            components: configuration.paths?.components ?? 'app/components',
            examples: configuration.paths?.examples ?? 'app/routes',
        });
    }

    protected createExample(slot: Slot): Promise<Example> {
        // Hydrogen file-based routing serves `app/routes/<slug>.tsx` at `/<slug>`.
        return Promise.resolve(new UrlExample(slot.name, `/${slot.slug}`));
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const [isTypeScript, era] = await Promise.all([
            this.isTypeScriptProject(),
            this.detectEra(),
        ]);

        const paths = await this.getPaths(installation.configuration);

        const generator = new HydrogenExampleGenerator({
            typescript: isTypeScript,
            era: era,
            routeFilePath: this.fileSystem.joinPaths(paths.examples, `%slug%${isTypeScript ? '.tsx' : '.jsx'}`),
            routeComponentName: '%name%Route',
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
        const project = await this.getProjectInfo();

        return {
            dependencies: ['@croct/plug-hydrogen'],
            tasks: this.getInstallationTasks({...installation, project: project}),
            configuration: configuration,
        };
    }

    private async getProjectInfo(): Promise<HydrogenProjectInfo> {
        const projectDirectory = this.projectDirectory.get();

        const [era, viteConfig, server, root, context, entryServer] = await Promise.all([
            this.detectEra(),
            this.locateFile('vite.config.ts', 'vite.config.js', 'vite.config.mts'),
            this.locateFile('server.ts', 'server.js'),
            this.locateFile('app/root.tsx', 'app/root.jsx'),
            this.locateFile('app/lib/context.ts', 'app/lib/context.js'),
            this.locateFile('app/entry.server.tsx', 'app/entry.server.jsx'),
        ]);

        return {
            era: era,
            viteConfig: viteConfig,
            server: server,
            root: root,
            context: context,
            entryServer: entryServer,
            envFile: new EnvFile(this.fileSystem, this.fileSystem.joinPaths(projectDirectory, '.env')),
        };
    }

    /**
     * Detects the era from the `@shopify/hydrogen` version, falling back to the routing dependency.
     */
    private async detectEra(): Promise<Era> {
        const [byVersion, hasReactRouter] = await Promise.all([
            this.packageManager.hasDirectDependency('@shopify/hydrogen', '>=2025.5.0'),
            this.packageManager.hasDirectDependency('react-router'),
        ]);

        return byVersion || hasReactRouter ? 'react-router' : 'remix';
    }

    private getInstallationTasks(installation: HydrogenInstallation): Task[] {
        const {project} = installation;

        const tasks: Task[] = [
            {
                title: 'Set up environment variables',
                task: async notifier => {
                    notifier.update('Setting up environment variables');

                    try {
                        await this.updateEnvVariables(installation);

                        notifier.confirm('Environment variables updated');
                    } catch (error) {
                        notifier.alert('Failed to update environment variables', HelpfulError.formatMessage(error));
                    }
                },
            },
            this.getCodemodTask('Register Vite plugin', 'vite', project.viteConfig),
            project.era === 'react-router'
                ? this.getCodemodTask('Register middleware', 'middleware', project.root)
                : this.getCodemodTask('Expose Croct context', 'context', project.context),
            this.getCodemodTask('Write Croct cookies', 'cookies', project.server),
            this.getProviderTask(project.root),
            this.getCodemodTask('Configure content security policy', 'csp', project.entryServer),
        ];

        return tasks;
    }

    private getCodemodTask(title: string, codemod: keyof CodemodConfiguration, file: string | null): Task {
        return {
            title: title,
            task: async notifier => {
                notifier.update(title);

                if (file === null) {
                    notifier.warn(`${title}: file not found`);

                    return;
                }

                try {
                    await this.applyCodemod(this.codemod[codemod], file);

                    notifier.confirm(title);
                } catch (error) {
                    notifier.alert(`Failed: ${title}`, HelpfulError.formatMessage(error));
                }
            },
        };
    }

    private getProviderTask(file: string | null): Task {
        return {
            title: 'Configure provider',
            task: async notifier => {
                notifier.update('Configuring provider');

                if (file === null) {
                    notifier.warn('Configure provider: app/root not found');

                    return;
                }

                try {
                    await this.applyCodemod(this.codemod.provider, file);

                    notifier.confirm('Provider configured');
                } catch (error) {
                    notifier.alert('Failed to configure provider', HelpfulError.formatMessage(error));
                }
            },
        };
    }

    private async applyCodemod<O extends CodemodOptions>(codemod: Codemod<string, O>, file: string): Promise<void> {
        await codemod.apply(this.fileSystem.joinPaths(this.projectDirectory.get(), file));
    }

    private async updateEnvVariables(installation: HydrogenInstallation): Promise<void> {
        const {project: {envFile}, configuration} = installation;

        const application = await this.workspaceApi.getApplication({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            applicationSlug: configuration.applications.development,
        });

        if (application === null) {
            throw new SdkError(
                `Development application \`${configuration.applications.development}\` not found.`,
                {reason: ErrorReason.NOT_FOUND},
            );
        }

        if (!await envFile.hasVariable(HydrogenEnvVar.API_KEY) && installation.skipApiKeySetup !== true) {
            const user = await this.userApi.getUser();

            let apiKey: GeneratedApiKey;

            try {
                apiKey = await this.applicationApi.createApiKey({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    applicationSlug: application.slug,
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

            await envFile.setVariables({[HydrogenEnvVar.API_KEY]: apiKey.secret});
        }

        await envFile.setVariables({[HydrogenEnvVar.APP_ID]: application.publicId});
    }
}
