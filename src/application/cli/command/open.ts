import {Command} from '@/application/cli/command/command';
import {ErrorReason, HelpfulError} from '@/application/error';

export type OpenInput = {
    url: string,
};

export type Program = (args: string[]) => Promise<void>;

export type OpenConfig = {
    protocol: string,
    program: Program,
};

export class OpenCommand implements Command<OpenInput> {
    private readonly program: Program;

    private readonly protocol: string;

    public constructor(config: OpenConfig) {
        this.program = config.program;
        this.protocol = config.protocol;
    }

    public async execute(input: OpenInput): Promise<void> {
        if (!URL.canParse(input.url)) {
            throw new HelpfulError('The URL is not valid.', {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        const url = new URL(input.url);

        if (!this.isValidUrl(url)) {
            throw new HelpfulError('The URL is not supported.', {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        await this.program(this.parseArguments(url));
    }

    private parseArguments(url: URL): string[] {
        const args: string[] = [];

        for (const segment of url.pathname.split('/')) {
            if (segment !== '') {
                args.push(segment);
            }
        }

        const rest: string[] = [];

        for (const [key, value] of url.searchParams) {
            if (key === 'arg') {
                rest.push(value);

                continue;
            }

            if (value === '') {
                args.push(`-${key.length === 1 ? '' : '-'}${key}`);

                continue;
            }

            args.push(`--${key}`);
            args.push(value);
        }

        args.push(...rest);

        return args;
    }

    private isValidUrl(url: URL): boolean {
        return url.protocol === `${this.protocol}:`
            && url.hostname === ''
            && url.username === ''
            && url.password === ''
            && url.port === ''
            && url.hash === '';
    }
}
