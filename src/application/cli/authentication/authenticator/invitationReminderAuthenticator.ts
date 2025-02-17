import {AuthenticationInput, Authenticator} from '@/application/cli/authentication/authenticator/index';
import {Form} from '@/application/cli/form/form';
import {InvitationOptions} from '@/application/cli/form/user/invitationForm';

export type Configuration<T extends AuthenticationInput> = {
    authenticator: Authenticator<T>,
    invitationForm: Form<void, InvitationOptions>,
};

export class InvitationReminderAuthenticator<T extends AuthenticationInput> implements Authenticator<T> {
    private readonly authenticator: Authenticator<T>;

    private readonly invitationForm: Form<void, InvitationOptions>;

    public constructor(config: Configuration<T>) {
        this.authenticator = config.authenticator;
        this.invitationForm = config.invitationForm;
    }

    public getToken(): Promise<string | null> {
        return this.authenticator.getToken();
    }

    public async login(input: T): Promise<string> {
        const token = await this.authenticator.login(input);

        await this.invitationForm.handle({});

        return token;
    }

    public logout(): Promise<void> {
        return this.authenticator.logout();
    }
}
