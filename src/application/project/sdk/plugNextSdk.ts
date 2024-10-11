import {access, readFile, writeFile, rename} from 'fs/promises';
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
        middlewarePath: string|null,
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

    public async resolve(hint?: string): Promise<Sdk|null> {
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
        const [isTypescript, middlewarePath] = await Promise.all([
            this.projectManager.isPackageListed('typescript'),
            this.localeFile(PlugNextSdk.MIDDLEWARE_FILES),
        ]);

        const nextInstallation: NextInstallation = {
            ...installation,
            project: {
                typescript: isTypescript,
                middlewarePath: middlewarePath,
            },
        };

        await this.installMiddleware(nextInstallation);
        await this.updateEnvFile(nextInstallation);

        return {
            ...configuration,
            locales: i18n.locales ?? configuration.locales,
        };
    }

    private async installMiddleware(installation: NextInstallation): Promise<void> {
        const fileName = `middleware.${installation.project.typescript ? 'ts' : 'js'}`;

        if (installation.project.middlewarePath === null) {
            return this.writeFile(
                fileName,
                'export {config, middleware} from \'@croct/plug-next/middleware\';',
            );
        }

        const newMiddlewareName = 'root-middleware';
        const newMiddlewarePath = `${newMiddlewareName}.${installation.project.typescript ? 'ts' : 'js'}`;

        await rename(
            installation.project.middlewarePath,
            join(this.projectManager.getDirectory(), newMiddlewarePath),
        );

        const middlewareImportPath = await this.projectManager.getImportPath(newMiddlewareName);

        return this.writeFile(
            fileName,
            `import * as config from '${middlewareImportPath}';\n\n`
            + 'export {withCroct} from \'@croct/plug-next/middleware\';\n\n'
            + 'export default {...config, middleware: withCroct(config.middleware)};',
        );
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

    private async readFile(fileNames: string[]): Promise<string|null> {
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

    private async localeFile(fileNames: string[]): Promise<string|null> {
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

    private async writeFile(path: string, content: string): Promise<void> {
        const fullPath = join(this.projectManager.getDirectory(), path);

        try {
            await writeFile(fullPath, content);
        } catch (error) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }
}
