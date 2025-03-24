import {ApiKey} from '@croct/sdk/apiKey';
import {Token} from '@croct/sdk/token';
import {Clock, Instant} from '@croct/time';
import {Authenticator} from '@/application/cli/authentication/authenticator/index';

export type Configuration = {
    apiKey: ApiKey,
    clock: Clock,
    tokenDuration: number,
};

export class ApiKeyAuthenticator implements Authenticator<Record<never, never>> {
    private readonly apiKey: ApiKey;

    private readonly clock: Clock;

    private readonly tokenDuration: number;

    private token?: Token;

    public constructor({apiKey, clock, tokenDuration}: Configuration) {
        this.apiKey = apiKey;
        this.clock = clock;
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

    private async issueToken(): Promise<Token> {
        const now = Instant.now(this.clock).getSeconds();
        const token = Token.of(
            {
                kid: await this.apiKey.getIdentifierHash(),
                alg: 'ES256',
                typ: 'JWT',
            },
            {
                iat: now,
                nbf: now,
                exp: now + this.tokenDuration,
                iss: 'cli.croct.com',
                aud: 'app.croct.com',
                scope: ['ADMIN'],
            },
        );

        return token.signedWith(this.apiKey);
    }
}
