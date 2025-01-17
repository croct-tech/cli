import {Provider} from '@/application/template/provider/provider';

export type RequestOptions = {
    headers?: Headers,
};

export type SuccessResponse = Omit<Response, 'ok' | 'body'> & {
    ok: true,
    body: ReadableStream,
};

export interface HttpProvider<T = SuccessResponse> extends Provider<T, RequestOptions> {
}
