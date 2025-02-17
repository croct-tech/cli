import {ApiKey} from '@croct/sdk/apiKey';
import {Token} from '@croct/sdk/token';
import {Authenticator} from '@/application/cli/authentication/authenticator/index';

export type Configuration = {
    apiKey: ApiKey,
    tokenDuration: number,
};

export class ApiKeyAuthenticator implements Authenticator<Record<never, never>> {
    private readonly apiKey: ApiKey;

    private readonly tokenDuration: number;

    private token?: Token;

    public constructor({apiKey, tokenDuration}: Configuration) {
        this.apiKey = apiKey;
        this.tokenDuration = tokenDuration;
    }

    public getToken(): Promise<string|null> {
        return Promise.resolve(this.token?.toString() ?? null);
    }

    public async login(): Promise<string> {
        this.token = await this.issueToken();

        return this.token.toString();
    }

    public logout(): Promise<void> {
        this.token = undefined;

        return Promise.resolve();
    }

    private issueToken(): Promise<Token> {
        const now = Math.trunc(Date.now() / 1000);

        return Token.of(
            {
                kid: `${this.apiKey.getIdentifier()}`,
                alg: 'ES256',
                typ: 'JWT',
            },
            {
                iat: now,
                nbf: now,
                exp: now + this.tokenDuration,
                iss: 'cli.croct.com',
                aud: 'croct.com',
                scope: ['ADMIN'],
            },
        ).signedWith(this.apiKey);
    }
}
