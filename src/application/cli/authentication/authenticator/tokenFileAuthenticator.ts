import {mkdir, readFile, unlink, writeFile} from 'fs/promises';
import {dirname} from 'path';
import {AuthenticationInput, Authenticator} from '@/application/cli/authentication/authenticator/index';
import {CliError, CliErrorCode} from '@/application/cli/error';

export type Configuration<I extends AuthenticationInput>= {
    filePath: string,
    authenticator: Authenticator<I>,
};

export class TokenFileAuthenticator<I extends AuthenticationInput> implements Authenticator<I> {
    private readonly filePath: string;

    private readonly authenticator: Authenticator<I>;

    public constructor({filePath, authenticator}: Configuration<I>) {
        this.filePath = filePath;
        this.authenticator = authenticator;
    }

    public async getToken(): Promise<string|null> {
        try {
            return await readFile(this.filePath, 'utf-8');
        } catch {
            return this.authenticator.getToken();
        }
    }

    public async login(input: I): Promise<string> {
        const token = await this.authenticator.login(input);

        await this.saveToken(token);

        return token;
    }

    public async logout(): Promise<void> {
        await this.authenticator.logout();

        try {
            await unlink(this.filePath);
        } catch (error) {
            if ((error instanceof Error) && 'code' in error && error.code !== 'ENOENT') {
                throw new CliError(
                    `Failed to logout, check file permissions for ${this.filePath}`,
                    {
                        code: CliErrorCode.OTHER,
                        cause: error,
                    },
                );
            }
        }
    }

    private async saveToken(token: string): Promise<void> {
        try {
            const dir = dirname(this.filePath);

            await mkdir(dir, {recursive: true});

            await writeFile(this.filePath, token, {flag: 'w', encoding: 'utf-8'});
        } catch (cause) {
            throw new CliError(
                `Failed to save token, check file permissions for ${this.filePath}`,
                {
                    code: CliErrorCode.OTHER,
                    cause: cause,
                },
            );
        }
    }
}
