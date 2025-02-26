import {JsonValue} from '@croct/json';
import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {HttpProvider} from '@/application/provider/resource/httpProvider';
import {ErrorReason} from '@/application/error';

export type BodyReader<T> = (response: Response) => Promise<T>;

export type Configuration<T> = {
    provider: HttpProvider,
    reader: BodyReader<T>,
};

export class HttpResponseBody<T> implements ResourceProvider<T> {
    private readonly provider: HttpProvider;

    private readonly reader: BodyReader<T>;

    public constructor({provider, reader}: Configuration<T>) {
        this.provider = provider;
        this.reader = reader;
    }

    public static text(provider: HttpProvider): HttpResponseBody<string> {
        return new HttpResponseBody({
            provider: provider,
            reader: response => response.text(),
        });
    }

    public static json(provider: HttpProvider): HttpResponseBody<JsonValue> {
        return new HttpResponseBody({
            provider: provider,
            reader: response => response.json() as Promise<JsonValue>,
        });
    }

    public static blob(provider: HttpProvider): HttpResponseBody<Blob> {
        return new HttpResponseBody({
            provider: provider,
            reader: response => response.blob(),
        });
    }

    public async get(url: URL): Promise<Resource<T>> {
        const response = await this.provider.get(url);

        let value: T;

        try {
            value = await this.reader(new Response(response.value.body));
        } catch (error) {
            throw new ResourceProviderError('Failed to read response body.', {
                reason: ErrorReason.UNEXPECTED_RESULT,
                url: url,
                cause: error,
            });
        }

        return {
            url: response.url,
            value: value,
        };
    }
}
