import {Resource, ResourceProvider} from '@/application/provider/resourceProvider';
import {Provider} from '@/application/provider/provider';

export type Mapping = {
    pattern: RegExp|string,
    destination: string|URL,
};

export type Configuration<T> = {
    dataProvider: ResourceProvider<T>,
    registryProvider: Provider<Mapping[]>,
};

export class MappedProvider<T> implements ResourceProvider<T> {
    private readonly dataProvider: ResourceProvider<T>;

    private readonly registryProvider: Provider<Mapping[]>;

    public constructor({dataProvider, registryProvider}: Configuration<T>) {
        this.dataProvider = dataProvider;
        this.registryProvider = registryProvider;
    }

    public supports(url: URL): boolean {
        return this.dataProvider.supports(url);
    }

    public async get(url: URL): Promise<Resource<T>> {
        return this.dataProvider.get(await this.resolveUrl(url));
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
