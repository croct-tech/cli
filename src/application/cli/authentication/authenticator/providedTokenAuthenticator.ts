import {Token} from '@croct/sdk/token';
import {Authenticator} from '@/application/cli/authentication/authenticator/index';
import {ErrorReason, HelpfulError} from '@/application/error';

export type Configuration = {
    token: Token,
};

export class ProvidedTokenAuthenticator implements Authenticator<Record<never, never>> {
    private readonly token: Token;

    public constructor({token}: Configuration) {
        this.token = token;
    }

    public getToken(): Promise<string|null> {
        return Promise.resolve(this.token.toString());
    }

    public login(): Promise<string> {
        this.reportUnsupportedOperation('logout');
    }

    public logout(): Promise<void> {
        this.reportUnsupportedOperation('logout');
    }

    private reportUnsupportedOperation(operation: 'login' | 'logout'): never {
        throw new HelpfulError(
            `${operation === 'login' ? 'Login' : 'Logout'} is not supported when using an externally provided token.`,
            {
                title: 'Unsupported operation',
                reason: ErrorReason.PRECONDITION,
                suggestions: [
                    'Do not specify the `--token` option or the `CROCT_TOKEN` environment variable.',
                ],
            },
        );
    }
}
