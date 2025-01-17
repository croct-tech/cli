import {AuthenticationInput, Authenticator} from '@/application/cli/authentication/authenticator/index';
import {FileSystem} from '@/application/fs/fileSystem';
import {HelpfulError, ErrorReason} from '@/application/error';

export type Configuration<I extends AuthenticationInput>= {
    filePath: string,
    authenticator: Authenticator<I>,
    fileSystem: FileSystem,
};

export class TokenFileAuthenticator<I extends AuthenticationInput> implements Authenticator<I> {
    private readonly filePath: string;

    private readonly authenticator: Authenticator<I>;

    private readonly fileSystem: FileSystem;

    public constructor({filePath, authenticator, fileSystem}: Configuration<I>) {
        this.filePath = filePath;
        this.authenticator = authenticator;
        this.fileSystem = fileSystem;
    }

    public async getToken(): Promise<string|null> {
        try {
            return await this.fileSystem.readTextFile(this.filePath);
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
            await this.fileSystem.delete(this.filePath);
        } catch (error) {
            if ((error instanceof Error) && 'code' in error && error.code !== 'ENOENT') {
                throw new HelpfulError(
                    'Failed to delete token file.',
                    {
                        reason: ErrorReason.OTHER,
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
            const directory = this.fileSystem.getDirectoryName(this.filePath);

            if (!await this.fileSystem.exists(directory)) {
                await this.fileSystem.createDirectory(directory, {recursive: true});
            }

            await this.fileSystem.writeTextFile(this.filePath, token, {overwrite: true});
        } catch (cause) {
            throw new HelpfulError(
                'Failed to save token to file.',
                {
                    reason: ErrorReason.OTHER,
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
