import {Token} from '@croct/sdk/token';
import {Authenticator} from '@/application/cli/authentication/authenticator/index';
import {HelpfulError} from '@/application/error';

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
        throw new HelpfulError('Externally provided token cannot be used to login.');
    }

    public logout(): Promise<void> {
        return Promise.resolve();
    }
}
