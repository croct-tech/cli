import {HttpProvider, SuccessResponse} from '@/application/provider/resource/httpProvider';
import {Resource, ResourceNotFoundError, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {ErrorReason} from '@/application/error';

export type Configuration = {
    retry?: {
        delay?: number,
        maxAttempts: number,
    },
};

export class FetchProvider implements HttpProvider {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration = {}) {
        this.configuration = configuration;
    }

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

        return {
            url: url,
            value: await this.fetch(url),
        };
    }

    private async fetch(url: URL, attempt: number = 0): Promise<SuccessResponse> {
        const response = await fetch(url);

        if (response.status === 404) {
            throw new ResourceNotFoundError('Resource not found.', {url: url});
        }

        const {maxAttempts = 0, delay = 1000} = this.configuration.retry ?? {};

        if (FetchProvider.isSuccessful(response)) {
            return response;
        }

        if (FetchProvider.isRetryableCode(response.status) && attempt < maxAttempts) {
            await new Promise(resolve => {
                setTimeout(resolve, delay);
            });

            return this.fetch(url, attempt + 1);
        }

        throw new ResourceProviderError(response.statusText, {url: url});
    }

    private static isSuccessful(response: Response): response is SuccessResponse {
        return response.ok && response.body !== null;
    }

    private static isRetryableCode(code: number): boolean {
        return code >= 500 || [429, 408].includes(code);
    }
}
