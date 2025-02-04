import {JsonValue} from '@croct/json';
import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resourceProvider';
import {JsonParser} from '@/infrastructure/json';
import {ErrorReason} from '@/application/error';

export class JsonProvider implements ResourceProvider<JsonValue> {
    private readonly provider: ResourceProvider<string>;

    public constructor(provider: ResourceProvider<string>) {
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL): Promise<Resource<JsonValue>> {
        const {value, ...resource} = await this.provider.get(url);

        try {
            return {
                ...resource,
                value: JsonParser.parse(value).toJSON(),
            };
        } catch (error) {
            throw new ResourceProviderError('Malformed JSON.', {
                reason: ErrorReason.PRECONDITION,
                url: url,
                cause: error,
            });
        }
    }
}
