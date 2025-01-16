import {Transport, TransportOptions} from '@/application/template/transport/transport';

export type Pattern = {
    pattern: RegExp,
    template: string,
};

export type Configuration<T, O extends TransportOptions> = {
    transport: Transport<T, O>,
    mapping: Pattern[],
};

export class MappedTransport<T, O extends TransportOptions> implements Transport<T, O> {
    private readonly transport: Transport<T, O>;

    private readonly patterns: Pattern[];

    public constructor({transport, mapping}: Configuration<T, O>) {
        this.transport = transport;
        this.patterns = mapping;
    }

    public supports(url: URL): boolean {
        return this.transport.supports(url);
    }

    public fetch(url: URL, options?: O): Promise<T> {
        return this.transport.fetch(this.resolveUrl(url), options);
    }

    private resolveUrl(url: URL): URL {
        for (const {pattern, template} of this.patterns) {
            const match = url.href.match(pattern);

            if (match === null) {
                continue;
            }

            return new URL(template.replace(/\$([0-9]+)/g, (_, index) => match[Number.parseInt(index, 10)]));
        }

        return url;
    }
}
