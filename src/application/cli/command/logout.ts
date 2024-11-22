import {Command} from '@/application/cli/command/command';
import {Authenticator} from '@/application/cli/authentication/authenticator/authenticator';

export type LogoutInput = Record<string, never>;
export type LogoutConfig = {
    authenticator: Authenticator,
};

export class LogoutCommand implements Command<LogoutInput> {
    private readonly authenticator: Authenticator;

    public constructor(config: LogoutConfig) {
        this.authenticator = config.authenticator;
    }

    public async execute(): Promise<void> {
        await this.authenticator.logout();
    }
}
