import {resolve} from 'node:path';
import {readFile} from 'fs/promises';
import {parse} from '@babel/parser';
import traverse from '@babel/traverse';
import {join} from 'path';
import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/model/project';
import {ApplicationApi} from '@/application/api/application';
import {PackageManager} from '@/application/project/packageManager';
import {WorkspaceApi} from '@/application/api/workspace';
import {EnvFile} from '@/application/project/envFile';
import {UserApi} from '@/application/api/user';

type NextI18nConfig = {
    locales: string[],
    defaultLocale?: string,
};

export type Configuration = {
    packageManager: PackageManager,
    api: {
        user: UserApi,
        workspace: WorkspaceApi,
        application: ApplicationApi,
    },
};

export class PlugNextSdk extends JavaScriptSdk implements SdkResolver {
    private readonly userApi: UserApi;

    private readonly workspaceApi: WorkspaceApi;

    private readonly applicationApi: ApplicationApi;

    public constructor(config: Configuration) {
        super(config.packageManager);

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
            this.packageManager.isPackageListed(this.getPackage()),
            this.packageManager.isPackageListed('next'),
        ]);

        return hints.some(Boolean) ? this : null;
    }

    protected async configure(installation: Installation): Promise<ProjectConfiguration> {
        const {configuration} = installation;
        const config = await this.getI18nConfig();

        await this.updateEnvFile(installation);

        return {
            ...configuration,
            locales: config.locales ?? configuration.locales,
        };
    }

    private async updateEnvFile(installation: Installation): Promise<void> {
        const {configuration, output} = installation;

        const spinner = output.createSpinner('Loading application information');

        try {
            const [user, application] = await Promise.all([
                await this.userApi.getUser(),
                await this.workspaceApi.getApplication(
                    configuration.organization,
                    configuration.workspace,
                    configuration.applications.development,
                ),
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

            const file = new EnvFile(join(this.packageManager.getDirectory(), '.env.local'));

            await file.setVariables({
                NEXT_PUBLIC_CROCT_APP_ID: application.publicId,
                CROCT_API_KEY: apiKey.secret,
            });

            spinner.succeed('.env.local updated');
        } finally {
            spinner.stop();
        }
    }

    private async getI18nConfig(): Promise<NextI18nConfig> {
        const config = await this.readNextConfig();

        if (config === null) {
            return {locales: []};
        }

        const ast = parse(config, {
            sourceType: 'module',
            plugins: ['typescript'],
        });

        const i18n = {
            locales: Array<string>(),
            defaultLocale: '',
        } satisfies NextI18nConfig;

        traverse(ast, {
            enter: path => {
                if (
                    path.node.type === 'ObjectProperty'
                    && path.node.key.type === 'Identifier'
                    && path.node.key.name === 'i18n'
                ) {
                    const object = path.node.value;

                    if (object.type === 'ObjectExpression') {
                        for (const property of object.properties) {
                            if (
                                property.type === 'ObjectProperty'
                                && property.key.type === 'Identifier'
                                && property.key.name === 'locales'
                            ) {
                                const localesNode = property.value;

                                if (localesNode.type === 'ArrayExpression') {
                                    for (const element of localesNode.elements) {
                                        if (element !== null && element.type === 'StringLiteral') {
                                            i18n.locales.push(element.value);
                                        }
                                    }
                                }
                            } else if (
                                property.type === 'ObjectProperty'
                                && property.key.type === 'Identifier'
                                && property.key.name === 'defaultLocale'
                            ) {
                                const defaultLocaleNode = property.value;

                                if (defaultLocaleNode !== null && defaultLocaleNode.type === 'StringLiteral') {
                                    i18n.defaultLocale = defaultLocaleNode.value;
                                }
                            }
                        }

                        path.stop();
                    }
                }
            },
        });

        return i18n;
    }

    private async readNextConfig(): Promise<string|null> {
        const filenames = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.mts'];

        for (const filename of filenames) {
            const fullPath = resolve(this.packageManager.getDirectory(), filename);

            try {
                return await readFile(fullPath, 'utf8');
            } catch {
                // Suppress error
            }
        }

        return Promise.resolve(null);
    }
}
