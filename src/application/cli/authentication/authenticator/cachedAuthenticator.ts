import {CacheProvider} from '@croct/cache';
import {deepEqual} from 'fast-equals';
import {AuthenticationInput, Authenticator} from '@/application/cli/authentication/authenticator/index';

export type Configuration<I extends AuthenticationInput>= {
    authenticator: Authenticator<I>,
    cacheKey: string,
    cacheProvider: CacheProvider<string, string|null>,
};

export class CachedAuthenticator<I extends AuthenticationInput> implements Authenticator<I> {
    private readonly authenticator: Authenticator<I>;

    private readonly cacheKey: string;

    private readonly tokenCache: CacheProvider<string, string|null>;

    private readonly inFlightCache: Map<I, Promise<string>> = new Map();

    public constructor({authenticator, cacheKey, cacheProvider}: Configuration<I>) {
        this.authenticator = authenticator;
        this.cacheKey = cacheKey;
        this.tokenCache = cacheProvider;
    }

    public getToken(): Promise<string|null> {
        return this.tokenCache.get(this.cacheKey, () => this.authenticator.getToken());
    }

    public login(input: I): Promise<string> {
        for (const [key, promise] of this.inFlightCache.entries()) {
            if (deepEqual(input, key)) {
                return promise;
            }
        }

        const promise = this.issueToken(input).finally(() => {
            this.inFlightCache.delete(input);
        });

        this.inFlightCache.set(input, promise);

        return promise;
    }

    private async issueToken(input: I): Promise<string> {
        const token = await this.authenticator.login(input);

        await this.tokenCache.set(this.cacheKey, token);

        return token;
    }

    public async logout(): Promise<void> {
        await this.authenticator.logout();
        await this.tokenCache.delete(this.cacheKey);
    }
}
