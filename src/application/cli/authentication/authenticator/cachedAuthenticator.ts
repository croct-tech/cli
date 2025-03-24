import {CacheProvider} from '@croct/cache';
import {AuthenticationInput, Authenticator} from '@/application/cli/authentication/authenticator/index';

export type Configuration<I extends AuthenticationInput>= {
    authenticator: Authenticator<I>,
    cacheKey: string,
    cacheProvider: CacheProvider<string, string|null>,
};

export class CachedAuthenticator<I extends AuthenticationInput> implements Authenticator<I> {
    private readonly authenticator: Authenticator<I>;

    private readonly cacheKey: string;

    private readonly cacheProvider: CacheProvider<string, string|null>;

    public constructor({authenticator, cacheKey, cacheProvider}: Configuration<I>) {
        this.authenticator = authenticator;
        this.cacheKey = cacheKey;
        this.cacheProvider = cacheProvider;
    }

    public getToken(): Promise<string|null> {
        return this.cacheProvider.get(this.cacheKey, () => this.authenticator.getToken());
    }

    public async login(input: I): Promise<string> {
        const token = await this.authenticator.login(input);

        await this.cacheProvider.set(this.cacheKey, token);

        return token;
    }

    public async logout(): Promise<void> {
        await this.authenticator.logout();
        await this.cacheProvider.delete(this.cacheKey);
    }
}
