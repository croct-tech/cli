import {JsonValue} from '@croct/json';
import {Provider, ProviderError, ProviderOptions} from '@/application/template/provider/provider';
import {JsonParser} from '@/infrastructure/json';

export class JsonProvider<O extends ProviderOptions> implements Provider<JsonValue, O> {
    private readonly provider: Provider<string, O>;

    public constructor(provider: Provider<string, O>) {
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
            throw new ProviderError('Malformed JSON.', url, {
                cause: error,
            });
        }
    }
}
