import {HttpProvider, SuccessResponse} from '@/application/provider/resource/httpProvider';
import {Resource, ResourceNotFoundError, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {ErrorReason} from '@/application/error';

export class FetchProvider implements HttpProvider {
    public async get(url: URL): Promise<Resource<SuccessResponse>> {
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new ResourceProviderError(
                'Unsupported protocol.',
                {
                    reason: ErrorReason.NOT_SUPPORTED,
                    url: url,
                },
            );
        }

        const response = await fetch(url);

        if (response.status === 404) {
            throw new ResourceNotFoundError('Resource not found.', {url: url});
        }

        if (!FetchProvider.isSuccessful(response)) {
            throw new ResourceProviderError(response.statusText, {url: url});
        }

        return {
            url: url,
            value: response,
        };
    }

    private static isSuccessful(response: Response): response is SuccessResponse {
        return response.ok && response.body !== null;
    }
}
