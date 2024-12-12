import {dirname} from 'path';
import {AuthenticationInput, Authenticator} from '@/application/cli/authentication/authenticator/index';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {Filesystem} from '@/application/filesystem/filesystem';

export type Configuration<I extends AuthenticationInput>= {
    filePath: string,
    authenticator: Authenticator<I>,
    filesystem: Filesystem,
};

export class TokenFileAuthenticator<I extends AuthenticationInput> implements Authenticator<I> {
    private readonly filePath: string;

    private readonly authenticator: Authenticator<I>;

    private readonly filesystem: Filesystem;

    public constructor({filePath, authenticator, filesystem}: Configuration<I>) {
        this.filePath = filePath;
        this.authenticator = authenticator;
        this.filesystem = filesystem;
    }

    public async getToken(): Promise<string|null> {
        try {
            return await this.filesystem.readFile(this.filePath);
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
            await this.filesystem.delete(this.filePath);
        } catch (error) {
            if ((error instanceof Error) && 'code' in error && error.code !== 'ENOENT') {
                throw new CliError(
                    'Failed to delete token file.',
                    {
                        code: CliErrorCode.OTHER,
                        suggestions: ['Try to delete the file manually'],
                        details: [`Token file: ${this.filePath}`],
                        cause: error,
                    },
                );
            }
        }
    }

    private async saveToken(token: string): Promise<void> {
        try {
            const directory = dirname(this.filePath);

            if (!await this.filesystem.exists(directory)) {
                await this.filesystem.createDirectory(directory, {recursive: true});
            }

            await this.filesystem.writeFile(this.filePath, token, {overwrite: true});
        } catch (cause) {
            throw new CliError(
                'Failed to save token to file.',
                {
                    code: CliErrorCode.OTHER,
                    suggestions: [
                        'If the file exists, try to delete it manually',
                        'Check the permissions of the directory',
                    ],
                    details: [`Token file: ${this.filePath}`],
                    cause: cause,
                },
            );
        }
    }
}
