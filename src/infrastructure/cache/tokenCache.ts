import {CacheLoader, CacheProvider} from '@croct/cache';
import {Clock, Instant} from '@croct/time';
import {Token} from '@croct/sdk/token';

export type TokenIssuer = (token: Token) => Promise<string>;

export type Configuration = {
    clock: Clock,
    tokenIssuer: TokenIssuer,
    tokenFreshPeriod: number,
    clockSkewTolerance: number,
    cacheProvider: CacheProvider<string, string>,
};

export class TokenCache implements CacheProvider<string, string|null> {
    private readonly clock: Clock;

    private readonly clockSkewTolerance: number;

    private readonly tokenIssuer: TokenIssuer;

    private readonly tokenFreshPeriod: number;

    private readonly cacheProvider: CacheProvider<string, string>;

    private readonly revalidating = new Map<string, true>();

    public constructor(config: Configuration) {
        this.clock = config.clock;
        this.clockSkewTolerance = config.clockSkewTolerance;
        this.cacheProvider = config.cacheProvider;
        this.tokenFreshPeriod = config.tokenFreshPeriod;
        this.tokenIssuer = config.tokenIssuer;
    }

    public async get(key: string, loader: CacheLoader<string, string|null>): Promise<string|null> {
        const cachedToken = await this.cacheProvider.get(key, async () => await loader(key) ?? '');

        if (cachedToken === '') {
            return null;
        }

        const token = this.parseToken(cachedToken);

        if (token !== null) {
            const tolerance = this.clockSkewTolerance;
            const now = this.clock
                .getInstant()
                .getSeconds();

            if (!token.isValidNow(now - tolerance) && !token.isValidNow(now + tolerance)) {
                return null;
            }

            this.revalidateToken(key, token).catch(() => {
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

        if (this.revalidating.has(key)) {
            return;
        }

        const issueTime = token.getIssueTime();
        const expirationTime = Instant.ofEpochSecond(issueTime + this.tokenFreshPeriod);

        if (now.isAfter(expirationTime)) {
            await this.renewToken(key, token);
        }
    }

    private async renewToken(key: string, token: Token): Promise<void> {
        const result = this.tokenIssuer(token);

        this.revalidating.set(key, true);

        try {
            await this.cacheProvider.set(key, await result);
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
