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
import {getImportSource} from '@/application/project/code/transformation/javascript/utils/getImportSource';
import type {ImportResolver} from '@/application/project/import/importResolver';

/**
 * The Hydrogen's underlying framework, which determines the codemod transformations.
 *
 * The boundary is `@shopify/hydrogen@2025.5.0`, where the skeleton migrated from
 * Remix to React Router 7.
 */
type Framework = 'react-router' | 'remix';

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
    importResolver: ImportResolver,
};

enum HydrogenEnvVar {
    API_KEY = 'CROCT_API_KEY',
    APP_ID = 'PUBLIC_CROCT_APP_ID',
}

type HydrogenProjectInfo = {
    framework: Framework,
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

type CodemodTaskOptions = {
    /**
     * The task title, shown while it runs.
     */
    title: string,

    /**
     * The success message confirmed once the codemod is applied.
     */
    confirmation: string,

    /**
     * The codemod to apply.
     */
    codemod: keyof CodemodConfiguration,

    /**
     * The target file, or null when it could not be located.
     */
    file: string | null,
};

export class PlugHydrogenSdk extends JavaScriptSdk {
    private readonly codemod: CodemodConfiguration;

    private readonly userApi: UserApi;

    private readonly applicationApi: ApplicationApi;

    private readonly importResolver: ImportResolver;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.codemod = configuration.codemod;
        this.userApi = configuration.userApi;
        this.applicationApi = configuration.applicationApi;
        this.importResolver = configuration.importResolver;
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
        const [isTypeScript, framework] = await Promise.all([
            this.isTypeScriptProject(),
            this.detectFramework(),
        ]);

        const paths = await this.getPaths(installation.configuration);

        const generator = new HydrogenExampleGenerator({
            typescript: isTypeScript,
            framework: framework,
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

        const [framework, viteConfig, server, root, entryServer] = await Promise.all([
            this.detectFramework(),
            this.locateFile(
                'vite.config.ts',
                'vite.config.mts',
                'vite.config.cts',
                'vite.config.js',
                'vite.config.mjs',
                'vite.config.cjs',
            ),
            this.locateFile('server.ts', 'server.js'),
            this.locateFile('app/root.tsx', 'app/root.jsx'),
            this.locateFile('app/entry.server.tsx', 'app/entry.server.jsx'),
        ]);

        // The load-context module is app code, not a fixed framework path, so follow its import
        // from the server entry before assuming the skeleton's conventional location.
        const context = await this.locateContext(server);

        return {
            framework: framework,
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
    private async detectFramework(): Promise<Framework> {
        const [hydrogenVersionUsesReactRouter, hasReactRouterDependency] = await Promise.all([
            this.packageManager.hasDirectDependency('@shopify/hydrogen', '>=2025.5.0'),
            this.packageManager.hasDirectDependency('react-router'),
        ]);

        return hydrogenVersionUsesReactRouter || hasReactRouterDependency ? 'react-router' : 'remix';
    }

    /**
     * Locates the load-context module.
     *
     * The skeleton puts it at `app/lib/context.*`, but it is ordinary app code referenced from the
     * server entry (e.g. `import {createAppLoadContext} from '~/lib/context'`), so it is resolved by
     * following that import first, falling back to the conventional path.
     */
    private async locateContext(server: string | null): Promise<string | null> {
        const imported = server !== null ? await this.followContextImport(server) : null;

        if (imported !== null) {
            return imported;
        }

        return this.locateFile(
            'app/lib/context.ts',
            'app/lib/context.tsx',
            'app/lib/context.js',
            'app/lib/context.jsx',
        );
    }

    /**
     * Resolves the load-context module by following its import in the server entry.
     *
     * The factory is imported from a local module (e.g. `import {createAppLoadContext} from
     * '~/lib/context'`); its name varies by era (`createAppLoadContext`, `createHydrogenRouterContext`).
     * The specifier is resolved through the project's tsconfig aliases.
     */
    private async followContextImport(server: string): Promise<string | null> {
        const source = await this.readFile(server);

        if (source === null) {
            return null;
        }

        const specifier = getImportSource(source, /^create[A-Za-z]*Context$/);

        return specifier !== null ? this.importResolver.resolveImport(specifier, server) : null;
    }

    private getInstallationTasks(installation: HydrogenInstallation): Task[] {
        const {project} = installation;

        return [
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
            this.getCodemodTask({
                title: 'Register Vite plugin',
                confirmation: 'Vite plugin registered',
                codemod: 'vite',
                file: project.viteConfig,
            }),
            project.framework === 'react-router'
                ? this.getCodemodTask({
                    title: 'Register middleware',
                    confirmation: 'Middleware registered',
                    codemod: 'middleware',
                    file: project.root,
                })
                : this.getCodemodTask({
                    title: 'Expose Croct context',
                    confirmation: 'Croct context exposed',
                    codemod: 'context',
                    file: project.context,
                }),
            this.getCodemodTask({
                title: 'Write Croct cookies',
                confirmation: 'Croct cookies written',
                codemod: 'cookies',
                file: project.server,
            }),
            this.getCodemodTask({
                title: 'Configure provider',
                confirmation: 'Provider configured',
                codemod: 'provider',
                file: project.root,
            }),
            this.getCodemodTask({
                title: 'Configure content security policy',
                confirmation: 'Content security policy configured',
                codemod: 'csp',
                file: project.entryServer,
            }),
        ];
    }

    private getCodemodTask({title, confirmation, codemod, file}: CodemodTaskOptions): Task {
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

                    notifier.confirm(confirmation);
                } catch (error) {
                    const action = `${title.charAt(0).toLowerCase()}${title.slice(1)}`;

                    notifier.alert(`Failed to ${action}`, HelpfulError.formatMessage(error));
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
