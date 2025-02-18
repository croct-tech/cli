import {CacheLoader, CacheProvider} from '@croct/cache';
import {Clock, Instant} from '@croct/time';
import {Token} from '@croct/sdk/token';
import {UserApi} from '@/application/api/user';

export type Configuration = {
    cacheProvider: CacheProvider<string, string>,
    userApi: UserApi,
    clock: Clock,
    tokenIssuer: string,
    cliTokenFreshPeriod: number,
    tokenDuration: number,
};

export class TokenCache implements CacheProvider<string, string|null> {
    private readonly cacheProvider: CacheProvider<string, string>;

    private readonly clock: Clock;

    private readonly tokenDuration: number;

    private readonly tokenIssuer: string;

    private readonly tokenFreshPeriod: number;

    private readonly userApi: UserApi;

    private readonly revalidating = new Map<string, true>();

    public constructor(config: Configuration) {
        this.cacheProvider = config.cacheProvider;
        this.clock = config.clock;
        this.tokenDuration = config.tokenDuration;
        this.tokenIssuer = config.tokenIssuer;
        this.tokenFreshPeriod = config.cliTokenFreshPeriod;
        this.userApi = config.userApi;
    }

    public async get(key: string, loader: CacheLoader<string, string|null>): Promise<string|null> {
        const cachedToken = await this.cacheProvider.get(key, async () => await loader(key) ?? '');

        if (cachedToken === '') {
            return null;
        }

        const now = this.clock.getInstant();
        const parsedToken = this.parseToken(cachedToken);

        if (parsedToken !== null) {
            if (!parsedToken.isValidNow(now.getSeconds())) {
                return null;
            }

            this.revalidateToken(key, parsedToken).catch(() => {
                // Suppress errors
            });
        }

        return cachedToken;
    }

    public set(key: string, value: string): Promise<void> {
        return this.cacheProvider.set(key, value);
    }

    public delete(key: string): Promise<void> {
        return this.cacheProvider.delete(key);
    }

    private async revalidateToken(key: string, token: Token): Promise<void> {
        const now = this.clock.getInstant();

        if (this.revalidating.has(key) || token.getIssuer() !== this.tokenIssuer) {
            return;
        }

        const issueTime = token.getIssueTime();
        const expirationTime = Instant.ofEpochSecond(issueTime + this.tokenFreshPeriod);

        if (now.isAfter(expirationTime)) {
            await this.renewToken(key);
        }
    }

    private async renewToken(key: string): Promise<void> {
        const promise = this.userApi.issueToken({
            duration: this.tokenDuration,
        });

        this.revalidating.set(key, true);

        try {
            await this.cacheProvider.set(key, await promise);
        } finally {
            this.revalidating.delete(key);
        }
    }

    private parseToken(token: string): Token|null {
        let parsedToken: Token;

        try {
            parsedToken = Token.parse(token);
        } catch {
            return null;
        }

        return parsedToken;
    }
}
