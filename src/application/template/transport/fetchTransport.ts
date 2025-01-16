import {HttpTransport, HttpTransportOptions, SuccessResponse} from '@/application/template/transport/httpTransport';
import {NotFoundError, TransportError} from '@/application/template/transport/transport';

export class FetchTransport implements HttpTransport {
    public supports(url: URL): boolean {
        return ['http:', 'https:'].includes(url.protocol);
    }

    public async fetch(url: URL, options?: HttpTransportOptions): Promise<SuccessResponse> {
        if (!this.supports(url)) {
            throw new TransportError('Unsupported protocol');
        }

        const response = await fetch(url, {
            headers: options?.headers,
        });

        if (!FetchTransport.isSuccessful(response)) {
            if (response.status === 404) {
                throw new NotFoundError(`Resource not found at ${url}`);
            }

            throw new TransportError(response.statusText);
        }

        return response;
    }

    private static isSuccessful(response: Response): response is SuccessResponse {
        return response.ok && response.body !== null;
    }
}
