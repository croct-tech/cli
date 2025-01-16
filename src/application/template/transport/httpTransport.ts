import {Transport} from '@/application/template/transport/transport';

export type HttpTransportOptions = {
    headers?: Headers,
};

export type SuccessResponse = Omit<Response, 'ok' | 'body'> & {
    ok: true,
    body: ReadableStream,
};

export interface HttpTransport extends Transport<SuccessResponse, HttpTransportOptions> {
}
