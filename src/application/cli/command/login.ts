import {Command} from '@/application/cli/command/command';
import {AuthenticationInput, Authenticator} from '@/application/cli/authentication/authenticator';

export type LoginInput<T extends AuthenticationInput> = T;

export type LoginConfig<T extends AuthenticationInput> = {
    authenticator: Authenticator<T>,
};

export class LoginCommand<T extends AuthenticationInput> implements Command<LoginInput<T>> {
    private readonly authenticator: Authenticator<T>;

    public constructor(config: LoginConfig<T>) {
        this.authenticator = config.authenticator;
    }

    public async execute(input: T): Promise<void> {
        await this.authenticator.logout();
        await this.authenticator.login(input);
    }
}
