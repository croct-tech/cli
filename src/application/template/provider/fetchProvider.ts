import {HttpProvider, SuccessResponse} from '@/application/template/provider/httpProvider';
import {Resource, ResourceNotFoundError, ResourceProviderError} from '@/application/provider/resourceProvider';

export class FetchProvider implements HttpProvider {
    public supports(url: URL): boolean {
        return ['http:', 'https:'].includes(url.protocol);
    }

    public async get(url: URL): Promise<Resource<SuccessResponse>> {
        if (!this.supports(url)) {
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

    private static isSuccessful(response: Response): response is SuccessResponse {
        return response.ok && response.body !== null;
    }
}
