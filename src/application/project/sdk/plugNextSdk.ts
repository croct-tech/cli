import {access, readFile, writeFile} from 'fs/promises';
import {join} from 'path';
import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/project/configuration';
import {ApplicationApi, GeneratedApiKey} from '@/application/api/application';
import {ProjectManager} from '@/application/project/projectManager';
import {WorkspaceApi} from '@/application/api/workspace';
import {EnvFile} from '@/application/project/envFile';
import {UserApi} from '@/application/api/user';
import {NextConfig, parseConfig} from '@/application/project/sdk/code/nextjs/parseConfig';
import {CodeTransformer} from '@/application/project/sdk/code/transformation';
import {hasImport} from '@/application/project/sdk/code/hasImport';

type ApiConfiguration = {
    user: UserApi,
    workspace: WorkspaceApi,
    application: ApplicationApi,
};

type CodemodConfiguration = {
    middleware: CodeTransformer<string>,
    appRouterProvider: CodeTransformer<string>,
    pageRouterProvider: CodeTransformer<string>,
};

export type Configuration = {
    projectManager: ProjectManager,
    api: ApiConfiguration,
    codemod: CodemodConfiguration,
};

type NextProjectInfo = {
    typescript: boolean,
    router: 'app' | 'page',
    sourceDirectory: string,
};

type NextInstallationPlan = {
    middleware: {
        file: string,
        new: boolean,
        installed: boolean,
    },
    provider: {
        file: string,
        new: boolean,
        installed: boolean,
    },
    env: {
        file: EnvFile,
        installed: {
            apiKey: boolean,
            appId: boolean,
        },
    },
};

type NextInstallation = Installation & {
    project: NextProjectInfo,
    plan: NextInstallationPlan,
};

enum NextEnvVar {
    API_KEY = 'CROCT_API_KEY',
    APP_ID = 'NEXT_PUBLIC_CROCT_APP_ID',
}

export class PlugNextSdk extends JavaScriptSdk implements SdkResolver {
    private readonly api: ApiConfiguration;

    private readonly codemod: CodemodConfiguration;

    public constructor(config: Configuration) {
        super(config.projectManager);

        this.api = config.api;
        this.codemod = config.codemod;
    }

    public getPackage(): string {
        return '@croct/plug-next';
    }

    public getPlatform(): ApplicationPlatform {
        return ApplicationPlatform.NEXT;
    }

    public async resolve(hint?: string): Promise<Sdk | null> {
        if (hint !== undefined) {
            return Promise.resolve(hint.toLowerCase() === this.getPlatform().toLowerCase() ? this : null);
        }

        const hints = await Promise.all([
            this.projectManager.isPackageListed(this.getPackage()),
            this.projectManager.isPackageListed('next'),
        ]);

        return hints.some(Boolean) ? this : null;
    }

    protected async configure(installation: Installation): Promise<ProjectConfiguration> {
        const {configuration} = installation;
        const [{i18n}, projectInfo] = await Promise.all([
            this.getConfig(),
            this.getProjectInfo(),
        ]);
        const plan = await this.getInstallationPlan(projectInfo);

        const nextInstallation: NextInstallation = {
            ...installation,
            project: projectInfo,
            plan: plan,
        };

        const {input, output} = installation;

        output.info('Project information:');
        output.info(`  - TypeScript: ${projectInfo.typescript ? 'yes' : 'no'}`);
        output.info(`  - Router: ${projectInfo.router}`);
        output.info(`  - Source directory: ${projectInfo.sourceDirectory}`);

        if (i18n.locales.length > 0) {
            output.info(`  - Locales: ${i18n.locales.join(', ')}`);
        }

        output.info('Installation plan:');

        const isMiddlewareInstalled = plan.middleware.installed;
        const isProviderInstalled = plan.provider.installed;
        const isEnvInstalled = plan.env.installed.apiKey && plan.env.installed.appId;

        if (!isMiddlewareInstalled) {
            output.info(
                nextInstallation.plan.middleware.new
                    ? ` Create ${nextInstallation.plan.middleware.file}`
                    : ` Configure ${nextInstallation.plan.middleware.file}`,
            );
        }

        if (!isProviderInstalled) {
            output.info(
                nextInstallation.plan.provider.new
                    ? ` Create ${nextInstallation.plan.provider.file}`
                    : ` Add provider to ${nextInstallation.plan.provider.file}`,
            );
        }

        if (!isEnvInstalled) {
            const {file} = plan.env;

            output.info(
                await file.exists()
                    ? ` Update ${file.getName()}`
                    : ` Create ${file.getName()}`,
            );
        }

        if (!await input.confirm({message: 'Proceed?'})) {
            output.log('Installation aborted');

            return output.exit();
        }

        if (!isMiddlewareInstalled) {
            await this.installMiddleware(nextInstallation);
        }

        if (!isProviderInstalled) {
            await this.installProvider(nextInstallation);
        }

        if (!isEnvInstalled) {
            await this.updateEnvFile(nextInstallation);
        }

        return {
            ...configuration,
            locales: i18n.locales ?? configuration.locales,
        };
    }

    private installProvider(installation: NextInstallation): Promise<boolean> {
        switch (installation.project.router) {
            case 'app':
                return this.installAppRouterProvider(installation);

            case 'page':
                return this.installPageRouterProvider(installation);
        }
    }

    private async installAppRouterProvider(installation: NextInstallation): Promise<boolean> {
        const {plan: {provider}, project: {typescript: isTypescript}} = installation;

        if (!provider.new) {
            return this.updateCode(this.codemod.pageRouterProvider, provider.file);
        }

        await this.writeFile(provider.file, [
            ...(isTypescript ? ['import type {ReactNode} from \'react\';'] : []),
            'import {CroctProvider} from \'@croct/plug-next/CroctProvider\';',
            '',
            installation.project.typescript
                ? 'export default function RootLayout({children}: {children: ReactNode}): ReactNode {'
                : 'export default function RootLayout({children}) {',
            '  return (',
            '    <html lang="en">',
            '      <body>',
            '        <CroctProvider>',
            '          {children}',
            '        </CroctProvider>',
            '      </body>',
            '    </html>',
            '  );',
            '}',
        ].join('\n'));

        return true;
    }

    private async installPageRouterProvider(installation: NextInstallation): Promise<boolean> {
        const {plan: {provider}, project: {typescript: isTypescript}} = installation;

        if (!provider.new) {
            return this.updateCode(this.codemod.pageRouterProvider, provider.file);
        }

        await this.writeFile(provider.file, [
            ...(
                isTypescript
                    ? [
                        'import type {ReactElement} from \'react\';',
                        'import type {AppProps} from \'next/app\';',
                    ]
                    : []
            ),
            'import {CroctProvider} from \'@croct/plug-next/CroctProvider\';',
            '',
            isTypescript
                ? 'export default function App({Component, pageProps}: AppProps): ReactElement {'
                : 'export default function App({Component, pageProps}) {',
            '  return (',
            '    <CroctProvider>',
            '      <Component {...pageProps} />',
            '     </CroctProvider>',
            '  );',
            '}',
        ].join('\n'));

        return true;
    }

    private async installMiddleware(installation: NextInstallation): Promise<boolean> {
        const {plan: {middleware}} = installation;

        if (!middleware.new) {
            return this.updateCode(this.codemod.middleware, middleware.file);
        }

        await this.writeFile(
            middleware.file,
            'export {config, middleware} from \'@croct/plug-next/middleware\';',
        );

        return true;
    }

    private async updateCode(codemod: CodeTransformer<string>, path: string): Promise<boolean> {
        const source = await this.readFile([path]);

        if (source === null) {
            return false;
        }

        const {modified, result} = codemod.transform(source);

        if (modified) {
            await this.writeFile(path, result, true);
        }

        return modified;
    }

    private async updateEnvFile(installation: NextInstallation): Promise<void> {
        const {plan: {env: plan}, configuration, output} = installation;

        const spinner = output.createSpinner('Loading application information');

        const {api} = this;

        try {
            const [user, application] = await Promise.all([
                await api.user.getUser(),
                await api.workspace.getApplication({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    applicationSlug: configuration.applications.development,
                }),
            ]);

            if (application === null) {
                output.error('Application not found');

                return;
            }

            let apiKey: GeneratedApiKey|null = null;

            if (!plan.installed.apiKey) {
                spinner.update('Creating API key');

                apiKey = await api.application.createApiKey({
                    name: `${user.username} CLI`,
                    applicationId: application.id,
                    permissions: {
                        tokenIssue: true,
                    },
                });
            }

            await plan.file.setVariables({
                [NextEnvVar.APP_ID]: application.publicId,
                ...(apiKey !== null ? {[NextEnvVar.API_KEY]: apiKey.secret} : {}),
            });

            spinner.succeed('.env.local updated');
        } catch (error) {
            spinner.fail(`Failed to update ${plan.file.getName()}`);

            throw error;
        } finally {
            spinner.stop();
        }
    }

    private async getInstallationPlan(project: NextProjectInfo): Promise<NextInstallationPlan> {
        const [middlewareFile, providerComponentFile] = await Promise.all([
            this.localeFile(
                ['middleware.js', 'middleware.ts'].map(file => join(project.sourceDirectory, file)),
            ),
            this.localeFile(
                (project.router === 'app' ? ['app/layout.jsx', 'app/layout.tsx'] : ['_app.jsx', '_app.tsx'])
                    .map(file => join(project.sourceDirectory, file)),
            ),
        ]);

        const [middlewareSource, providerSource] = await Promise.all([
            middlewareFile === null ? null : this.readFile([middlewareFile]),
            providerComponentFile === null ? null : this.readFile([providerComponentFile]),
        ]);

        const envFile = new EnvFile(join(this.projectManager.getDirectory(), '.env.local'));
        const [apiKeyVar, appIdVar] = await Promise.all([
            envFile.hasVariable(NextEnvVar.API_KEY),
            envFile.hasVariable(NextEnvVar.APP_ID),
        ]);

        const extension = project.typescript ? 'ts' : 'js';

        return {
            env: {
                file: envFile,
                installed: {
                    apiKey: apiKeyVar,
                    appId: appIdVar,
                },
            },
            middleware: {
                file: middlewareFile ?? join(project.sourceDirectory, `middleware.${extension}`),
                new: middlewareFile === null,
                installed: middlewareSource !== null
                    && hasImport(middlewareSource, {moduleName: '@croct/plug-next/middleware'}),
            },
            provider: {
                file: providerComponentFile ?? (
                    `${project.router === 'app' ? 'app/layout' : '_app'}.${extension}x`
                ),
                new: providerComponentFile === null,
                installed: providerSource !== null
                    && hasImport(providerSource, {moduleName: '@croct/plug-next/CroctProvider'}),
            },
        };
    }

    private async getProjectInfo(): Promise<NextProjectInfo> {
        const [isTypescript, directory] = await Promise.all([
            this.projectManager.isPackageListed('typescript'),
            this.localeFile(['app', 'src/app', 'pages', 'src/pages'])
                .then(path => path ?? 'app'),
        ]);

        return {
            typescript: isTypescript,
            router: directory.endsWith('app') ? 'app' : 'page',
            sourceDirectory: directory.startsWith('src') ? 'src' : './',
        };
    }

    private async getConfig(): Promise<NextConfig> {
        const config = await this.readFile([
            'next.config.js',
            'next.config.mjs',
            'next.config.ts',
            'next.config.mts',
        ]);

        if (config === null) {
            return {
                i18n: {
                    locales: [],
                    defaultLocale: '',
                },
            };
        }

        return parseConfig(config);
    }

    private async readFile(fileNames: string[]): Promise<string | null> {
        const filePath = await this.localeFile(fileNames);

        if (filePath === null) {
            return null;
        }

        const directory = this.projectManager.getDirectory();

        try {
            return await readFile(join(directory, filePath), 'utf8');
        } catch {
            // Suppress error
        }

        return null;
    }

    private async localeFile(fileNames: string[]): Promise<string | null> {
        const directory = this.projectManager.getDirectory();

        for (const filename of fileNames) {
            const fullPath = join(directory, filename);

            try {
                await access(fullPath);

                return filename;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    continue;
                }

                throw error;
            }
        }

        return null;
    }

    private async writeFile(path: string, content: string, overwrite = false): Promise<void> {
        const fullPath = join(this.projectManager.getDirectory(), path);

        try {
            // create file if it does not exist
            await writeFile(fullPath, content, {flag: overwrite ? 'w' : 'wx'});
        } catch (error) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }
}
