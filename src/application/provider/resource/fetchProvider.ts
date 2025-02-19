import {HttpProvider, SuccessResponse} from '@/application/provider/resource/httpProvider';
import {Resource, ResourceNotFoundError, ResourceProviderError} from '@/application/provider/resource/resourceProvider';

export class FetchProvider implements HttpProvider {
    public supports(url: URL): Promise<boolean> {
        return Promise.resolve(FetchProvider.supportsProtocol(url));
    }

    public async get(url: URL): Promise<Resource<SuccessResponse>> {
        if (!FetchProvider.supportsProtocol(url)) {
            throw new ResourceProviderError('Unsupported protocol.', {url: url});
        }

        const response = await fetch(url);

        if (!FetchProvider.isSuccessful(response)) {
            if (response.status === 404) {
                throw new ResourceNotFoundError('Resource not found.', {url: url});
            }

            throw new ResourceProviderError(response.statusText, {url: url});
        }

        return {
            url: url,
            value: response,
        };
    }

    private static supportsProtocol(url: URL): boolean {
        return ['http:', 'https:'].includes(url.protocol);
    }

    private static isSuccessful(response: Response): response is SuccessResponse {
        return response.ok && response.body !== null;
    }
}
