import {Command} from '@/application/cli/command/command';
import {Authenticator} from '@/application/cli/authentication/authenticator';

export type LoginInput = Record<string, never>;

export type LoginConfig = {
    authenticator: Authenticator,
};

export class LoginCommand implements Command<LoginInput> {
    private readonly authenticator: Authenticator;

    public constructor(config: LoginConfig) {
        this.authenticator = config.authenticator;
    }

    public async execute(): Promise<void> {
        await this.authenticator.logout();
        await this.authenticator.login();
    }
}
