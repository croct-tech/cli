import {Command} from '@/application/cli/command/command';
import {Authenticator} from '@/application/cli/authentication/authenticator/authenticator';

export type LogoutInput = Record<string, never>;

export type LogoutOutput = void;

export type LogoutConfig = {
    authenticator: Authenticator,
};

export class LogoutCommand implements Command<LogoutInput, LogoutOutput> {
    private readonly authenticator: Authenticator;

    public constructor(config: LogoutConfig) {
        this.authenticator = config.authenticator;
    }

    public async execute(): Promise<LogoutOutput> {
        await this.authenticator.logout();
    }
}
