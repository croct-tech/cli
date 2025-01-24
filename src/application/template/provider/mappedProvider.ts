import {ResourceProvider, ProviderOptions} from '@/application/provider/resourceProvider';
import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';

export type Mapping = {
    pattern: string|RegExp,
    destination: string|URL,
};

export type NormalizedMapping = {
    pattern: RegExp,
    destination: URL,
};

export type DenormalizedMapping = {
    pattern: string,
    destination: string,
};

export type DenormalizedRegistry = DenormalizedMapping[];

export type NormalizedRegistry = NormalizedMapping[];

export type Registry = Mapping[];

export type Configuration<T, O extends ProviderOptions> = {
    dataProvider: ResourceProvider<T, O>,
    registryProvider: ParameterlessProvider<Registry>,
};

export class MappedProvider<T, O extends ProviderOptions> implements ResourceProvider<T, O> {
    private readonly dataProvider: ResourceProvider<T, O>;

    private readonly registryProvider: ParameterlessProvider<Mapping[]>;

    public constructor({dataProvider, registryProvider}: Configuration<T, O>) {
        this.dataProvider = dataProvider;
        this.registryProvider = registryProvider;
    }

    public supports(url: URL): boolean {
        return this.dataProvider.supports(url);
    }

    public async get(url: URL, options?: O): Promise<T> {
        return this.dataProvider.get(await this.resolveUrl(url), options);
    }

    private async resolveUrl(url: URL): Promise<URL> {
        const mappings = await this.registryProvider.get();

        for (const {pattern, destination} of mappings) {
            const match = url.href.match(typeof pattern === 'string' ? new RegExp(pattern) : pattern);

            if (match === null) {
                continue;
            }

            return typeof destination === 'string'
                ? new URL(destination.replace(/\$([0-9]+)/g, (_, index) => match[Number.parseInt(index, 10)]))
                : destination;
        }

        return url;
    }
}
