import {CacheProvider} from '@croct/cache';
import {Validator} from '@/application/validation';
import {CliConfiguration, CliConfigurationProvider} from '@/application/cli/configuration/provider';

export type Configuration = {
    cache: CacheProvider<string, string>,
    cacheKey: string,
    validator: Validator<CliConfiguration>,
};

export class CachedConfigurationStore implements CliConfigurationProvider {
    private static readonly EMPTY_SETTINGS: CliConfiguration = {projectPaths: []};

    private readonly cache: CacheProvider<string, string>;

    private readonly cacheKey: string;

    private readonly validator: Validator<CliConfiguration>;

    public constructor({validator, cache, cacheKey}: Configuration) {
        this.cache = cache;
        this.cacheKey = cacheKey;
        this.validator = validator;
    }

    public async get(): Promise<CliConfiguration> {
        const content = await this.cache.get(this.cacheKey, () => Promise.resolve(''));

        if (content === '') {
            return CachedConfigurationStore.EMPTY_SETTINGS;
        }

        let json: unknown;

        try {
            json = JSON.parse(content);
        } catch (error) {
            return CachedConfigurationStore.EMPTY_SETTINGS;
        }

        const validation = await this.validator.validate(json);

        return validation.valid ? validation.data : CachedConfigurationStore.EMPTY_SETTINGS;
    }

    public async save(settings: CliConfiguration): Promise<void> {
        await this.cache.set(this.cacheKey, JSON.stringify(settings));
    }
}
