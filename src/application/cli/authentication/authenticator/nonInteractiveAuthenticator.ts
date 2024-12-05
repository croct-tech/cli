import {AuthenticationInput, Authenticator} from '@/application/cli/authentication/authenticator/index';
import {CliError, CliHelp} from '@/application/cli/error';

export type Instruction = CliHelp & {
    message: string,
};

export type Configuration<T extends AuthenticationInput> = {
    instruction: Instruction,
    authenticator: Authenticator<T>,
};

export class NonInteractiveAuthenticator<T extends AuthenticationInput> implements Authenticator<T> {
    private readonly instruction: Instruction;

    private readonly authenticator: Authenticator<T>;

    public constructor({instruction, authenticator}: Configuration<T>) {
        this.instruction = instruction;
        this.authenticator = authenticator;
    }

    public getToken(): Promise<string|null> {
        return this.authenticator.getToken();
    }

    public login(input: T): Promise<string> {
        if (Object.keys(input).length === 0) {
            const {message, ...help} = this.instruction;

            throw new CliError(message, help);
        }

        return this.authenticator.login(input);
    }

    public logout(): Promise<void> {
        return this.authenticator.logout();
    }
}
