import {Command} from '@/application/cli/command/command';
import {ErrorReason, HelpfulError} from '@/application/error';

export type LaunchInput = {
    target: string,
};

export type Program = (args: string[]) => Promise<void>;

export type LaunchConfig = {
    protocol: string,
    program: Program,
};

export class LaunchCommand implements Command<LaunchInput> {
    private readonly program: Program;

    private readonly protocol: string;

    public constructor(config: LaunchConfig) {
        this.program = config.program;
        this.protocol = config.protocol;
    }

    public async execute(input: LaunchInput): Promise<void> {
        if (!URL.canParse(input.target)) {
            throw new HelpfulError('The target is not a valid URL.', {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        const url = new URL(input.target);

        if (!this.isValidTarget(url)) {
            throw new HelpfulError('The target URL is not supported.', {
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

    private isValidTarget(url: URL): boolean {
        return url.protocol === `${this.protocol}:`
            && url.hostname === ''
            && url.username === ''
            && url.password === ''
            && url.port === ''
            && url.hash === '';
    }
}
