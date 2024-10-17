import {access, readFile, writeFile} from 'fs/promises';
import {join} from 'path';
import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/project/configuration';
import {ApplicationApi} from '@/application/api/application';
import {ProjectManager} from '@/application/project/projectManager';
import {WorkspaceApi} from '@/application/api/workspace';
import {EnvFile} from '@/application/project/envFile';
import {UserApi} from '@/application/api/user';
import {NextConfig, parseConfig} from '@/application/project/sdk/code/nextjs/parseConfig';
import {transform} from '@/application/project/sdk/code/transformation';
import {RefactorMiddleware} from '@/application/project/sdk/code/nextjs/refactorMiddleware';

export type Configuration = {
    projectManager: ProjectManager,
    api: {
        user: UserApi,
        workspace: WorkspaceApi,
        application: ApplicationApi,
    },
};

type NextInstallation = Installation & {
    project: {
        typescript: boolean,
        middlewarePath: string | null,
        router: 'app' | 'page',
    },
};

export class PlugNextSdk extends JavaScriptSdk implements SdkResolver {
    private static readonly CONFIG_FILES = [
        'next.config.js',
        'next.config.mjs',
        'next.config.ts',
        'next.config.mts',
    ];

    private static readonly MIDDLEWARE_FILES = [
        'middleware.js',
        'middleware.ts',
    ];

    private static readonly APP_FILES = [
        'pages/_app.jsx',
        'pages/_app.tsx',
    ];

    private static readonly LAYOUT_FILES = [
        'layouts/default.jsx',
        'layouts/default.tsx',
    ];

    private readonly userApi: UserApi;

    private readonly workspaceApi: WorkspaceApi;

    private readonly applicationApi: ApplicationApi;

    public constructor(config: Configuration) {
        super(config.projectManager);

        this.workspaceApi = config.api.workspace;
        this.applicationApi = config.api.application;
        this.userApi = config.api.user;
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
        const {i18n} = await this.getConfig();
        const [isTypescript, middlewarePath, router] = await Promise.all([
            this.projectManager.isPackageListed('typescript'),
            this.localeFile(PlugNextSdk.MIDDLEWARE_FILES),
            access(join(this.projectManager.getDirectory(), 'pages')).then(() => 'page' as const)
                .catch(() => 'app' as const),
        ]);

        const nextInstallation: NextInstallation = {
            ...installation,
            project: {
                typescript: isTypescript,
                middlewarePath: middlewarePath,
                router: router,
            },
        };

        await this.installMiddleware(nextInstallation);
        await this.updateEnvFile(nextInstallation);

        return {
            ...configuration,
            locales: i18n.locales ?? configuration.locales,
        };
    }

    private installProvider(installation: NextInstallation): Promise<void> {
        switch (installation.project.router) {
            case 'app':
                return this.installAppRouterProvider(installation);
            case 'page':
                return this.installPageRouterProvider(installation);
        }
    }

    private installAppRouterProvider(installation: NextInstallation): Promise<void> {
    }

    private installPageRouterProvider(installation: NextInstallation): Promise<void> {
        const appFile = this.localeFile(PlugNextSdk.APP_FILES);

        if (appFile === null) {
            return this.writeFile(
                'pages/_app.tsx',
                [
                    'import type {ReactElement} from \'react\';',
                    installation.project.typescript
                        ? 'import type {AppProps} from \'next/app\';'
                        : null,
                    'import {CroctProvider} from \'@croct/plug-next/CroctProvider\';',
                    '',
                    installation.project.typescript
                        ? 'export default function App({Component, pageProps}: AppProps): ReactElement {'
                        : 'export default function App({Component, pageProps}) {',
                    '  return (',
                    '    <CroctProvider>',
                    '      <Component {...pageProps} />',
                    '     </CroctProvider>',
                    '  );',
                    '}',
                ].filter(line => line !== null).join('\n'),
            );
        }
    }

    private async installMiddleware(installation: NextInstallation): Promise<boolean> {
        if (installation.project.middlewarePath === null) {
            await this.writeFile(
                `middleware.${installation.project.typescript ? 'ts' : 'js'}`,
                'export {config, middleware} from \'@croct/plug-next/middleware\';',
            );

            return true;
        }

        const {modified, code} = transform(
            await readFile(installation.project.middlewarePath, 'utf8'),
            new RefactorMiddleware({
                import: {
                    module: '@croct/plug-next/middleware',
                    functionName: 'withCroct',
                    matcherName: 'matcher',
                    matcherLocalName: 'croctMatcher',
                },
            }),
        );

        if (modified) {
            await this.writeFile('middleware.ts', code, true);
        }

        return modified;
    }

    private async updateEnvFile(installation: NextInstallation): Promise<void> {
        const {configuration, output} = installation;

        const spinner = output.createSpinner('Loading application information');

        try {
            const [user, application] = await Promise.all([
                await this.userApi.getUser(),
                await this.workspaceApi.getApplication({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    applicationSlug: configuration.applications.development,
                }),
            ]);

            if (application === null) {
                output.error('Application not found');

                return;
            }

            spinner.update('Creating API key');

            const apiKey = await this.applicationApi.createApiKey({
                name: `${user.username} CLI`,
                applicationId: application.id,
                permissions: {
                    tokenIssue: true,
                },
            });

            const file = new EnvFile(join(this.projectManager.getDirectory(), '.env.local'));

            await file.setVariables({
                NEXT_PUBLIC_CROCT_APP_ID: application.publicId,
                CROCT_API_KEY: apiKey.secret,
            });

            spinner.succeed('.env.local updated');
        } finally {
            spinner.stop();
        }
    }

    private async getConfig(): Promise<NextConfig> {
        const config = await this.readFile(PlugNextSdk.CONFIG_FILES);

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

        try {
            return await readFile(filePath, 'utf8');
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

                return fullPath;
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
