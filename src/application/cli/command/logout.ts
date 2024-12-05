import {Command} from '@/application/cli/command/command';
import {Authenticator} from '@/application/cli/authentication/authenticator/authenticator';
import {Output} from '@/application/cli/io/output';

export type LogoutInput = Record<string, never>;
export type LogoutConfig = {
    authenticator: Authenticator<never>,
    output: Output,
};

export class LogoutCommand implements Command<LogoutInput> {
    private readonly authenticator: Authenticator<never>;

    private readonly output: Output;

    public constructor({output, authenticator}: LogoutConfig) {
        this.authenticator = authenticator;
        this.output = output;
    }

    public async execute(): Promise<void> {
        await this.authenticator.logout();

        this.output.confirm('Logged out');
    }
}
