import {HttpProvider, RequestOptions, SuccessResponse} from '@/application/template/provider/httpProvider';
import {NotFoundError, ProviderError} from '@/application/template/provider/provider';

export class FetchProvider implements HttpProvider {
    public supports(url: URL): boolean {
        return ['http:', 'https:'].includes(url.protocol);
    }

    public async get(url: URL, options?: RequestOptions): Promise<SuccessResponse> {
        if (!this.supports(url)) {
            throw new ProviderError('Unsupported protocol', url);
        }

        const response = await fetch(url, {
            headers: options?.headers,
        });

        if (!FetchProvider.isSuccessful(response)) {
            if (response.status === 404) {
                throw new NotFoundError('Resource not found', url);
            }

            throw new ProviderError(response.statusText, url);
        }

        return response;
    }

    private static isSuccessful(response: Response): response is SuccessResponse {
        return response.ok && response.body !== null;
    }
}
