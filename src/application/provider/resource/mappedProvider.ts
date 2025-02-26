import {Resource, ResourceProvider} from '@/application/provider/resource/resourceProvider';
import {Provider} from '@/application/provider/provider';

export type Mapping = {
    pattern: RegExp|string,
    destination: string|URL,
};

export type Configuration<T> = {
    dataProvider: ResourceProvider<T>,
    registryProvider: Provider<Mapping[]> | ResourceProvider<Mapping[]>,
    baseUrl?: URL,
};

export class MappedProvider<T> implements ResourceProvider<T> {
    private readonly dataProvider: ResourceProvider<T>;

    private readonly registryProvider: Provider<Mapping[]> | ResourceProvider<Mapping[]>;

    private readonly baseUrl?: URL;

    public constructor({dataProvider, registryProvider, baseUrl}: Configuration<T>) {
        this.dataProvider = dataProvider;
        this.registryProvider = registryProvider;
        this.baseUrl = baseUrl;
    }

    public async get(url: URL): Promise<Resource<T>> {
        return this.dataProvider.get(await this.resolveUrl(url));
    }

    private async resolveUrl(url: URL): Promise<URL> {
        for (const {pattern, destination} of await this.loadMappings(url)) {
            const match = url.href.match(typeof pattern === 'string' ? new RegExp(pattern) : pattern);

            if (match === null) {
                continue;
            }

            if (destination instanceof URL) {
                return destination;
            }

            return new URL(
                destination.replace(/\$([0-9]+)/g, (_, index) => match[Number.parseInt(index, 10)]),
                this.baseUrl,
            );
        }

        return url;
    }

    private async loadMappings(url: URL): Promise<Mapping[]> {
        const mapping = await this.registryProvider.get(url);

        if (!Array.isArray(mapping)) {
            return mapping.value;
        }

        return mapping;
    }
}
