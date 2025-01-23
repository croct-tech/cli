import {JsonValue} from '@croct/json';
import {ResourceProvider, ResourceProviderError, ProviderOptions} from '@/application/provider/resourceProvider';
import {JsonParser} from '@/infrastructure/json';

export class JsonProvider<O extends ProviderOptions> implements ResourceProvider<JsonValue, O> {
    private readonly provider: ResourceProvider<string, O>;

    public constructor(provider: ResourceProvider<string, O>) {
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL, options?: O): Promise<JsonValue> {
        const source = await this.provider.get(url, options);

        try {
            return JsonParser.parse(source).toJSON();
        } catch (error) {
            throw new ResourceProviderError('Malformed JSON.', url, {
                cause: error,
            });
        }
    }
}
