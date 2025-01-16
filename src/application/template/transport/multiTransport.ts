import {Transport, TransportError, TransportOptions} from '@/application/template/transport/transport';

export class MultiTransport<T, O extends TransportOptions> implements Transport<T, O> {
    private readonly transports: Array<Transport<T, O>>;

    public constructor(transport: Transport<T, O>, ...transports: Array<Transport<T, O>>) {
        this.transports = [transport, ...transports];
    }

    public supports(url: URL): boolean {
        return this.transports.some(transport => transport.supports(url));
    }

    public fetch(url: URL, options?: O): Promise<T> {
        for (const transport of this.transports) {
            if (transport.supports(url)) {
                return transport.fetch(url, options);
            }
        }

        throw new TransportError('No suitable transport found.');
    }
}
