import {JsonValue} from '@croct/json';
import {JsonParser} from '@croct/json5-parser';
import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {ErrorReason} from '@/application/error';

export class Json5Provider implements ResourceProvider<JsonValue> {
    private readonly provider: ResourceProvider<string>;

    public constructor(provider: ResourceProvider<string>) {
        this.provider = provider;
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
