import {ResourceProvider} from '@/application/provider/resource/resourceProvider';

export type SuccessResponse = Omit<Response, 'ok' | 'body'> & {
    ok: true,
    body: ReadableStream,
};

export interface HttpProvider<T = SuccessResponse> extends ResourceProvider<T> {
}
