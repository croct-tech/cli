import {ResourceProvider} from '@/application/provider/resourceProvider';

export type SuccessResponse = Omit<Response, 'ok' | 'body'> & {
    ok: true,
    body: ReadableStream,
};

export interface HttpProvider<T = SuccessResponse> extends ResourceProvider<T> {
}
