import {mkdir, readFile, unlink, writeFile} from 'fs/promises';
import {dirname} from 'path';
import {Logger} from '@/application/cli/io/output';
import {Authenticator} from '@/application/cli/authentication/authenticator/index';

export type TokenFileAuthenticatorConfig = {
    filePath: string,
    authenticator: Authenticator,
    logger: Logger,
};

export class TokenFileAuthenticator implements Authenticator {
    private readonly filePath: string;

    private readonly authenticator: Authenticator;

    private readonly logger: Logger;

    public constructor({filePath, authenticator, logger}: TokenFileAuthenticatorConfig) {
        this.filePath = filePath;
        this.authenticator = authenticator;
        this.logger = logger;
    }

    public async getToken(): Promise<string | null> {
        try {
            return await readFile(this.filePath, 'utf-8');
        } catch {
            return this.authenticator.getToken();
        }
    }

    public async login(): Promise<string> {
        try {
            return await readFile(this.filePath, 'utf-8');
        } catch {
            const token = await this.authenticator.login();

            await this.saveToken(token);

            return token;
        }
    }

    public async logout(): Promise<void> {
        await this.authenticator.logout();

        try {
            await unlink(this.filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.warn(`Failed to logout, check permissions for ${this.filePath}`);
            }
        }
    }

    private async saveToken(token: string): Promise<void> {
        try {
            const dir = dirname(this.filePath);

            await mkdir(dir, {recursive: true});

            await writeFile(this.filePath, token, {flag: 'w', encoding: 'utf-8'});
        } catch {
            this.logger.warn(`Failed to save token, check permissions for ${dirname(this.filePath)}`);
        }
    }
}
