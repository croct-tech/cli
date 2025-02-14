import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {UserApi} from '@/application/api/user';
import {Token} from '@/application/cli/authentication/authentication';
import {Authenticator} from '@/application/cli/authentication/authenticator/index';
import {Form} from '@/application/cli/form/form';
import {SignInOptions} from '@/application/cli/form/auth/signInForm';
import {SignUpOptions} from '@/application/cli/form/auth/signUpForm';
import {EmailInput} from '@/application/cli/form/input/emailInput';

export type Configuration = {
    input: Input,
    output: Output,
    userApi: UserApi,
    form: {
        signIn: Form<Token, SignInOptions>,
        signUp: Form<Token, SignUpOptions>,
    },
};

export type CredentialsInput = {
    username?: string,
    password?: string,
};

export class CredentialsAuthenticator implements Authenticator<CredentialsInput> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public getToken(): Promise<string | null> {
        return Promise.resolve(null);
    }

    public login(credentials: CredentialsInput = {}): Promise<Token> {
        if (credentials.username === undefined || credentials.password === undefined) {
            return this.loginInteractively(credentials);
        }

        const {form} = this.config;

        return form.signIn.handle({
            email: credentials.username,
            password: credentials.password,
        });
    }

    private async loginInteractively(credentials: CredentialsInput): Promise<Token> {
        const {input, output, userApi, form} = this.config;

        const email = credentials.username ?? await EmailInput.prompt({
            input: input,
            label: 'Enter your email',
        });

        const notifier = output.notify('Finding account');

        const isRegistered = await userApi.isEmailRegistered(email);

        notifier.stop();

        if (isRegistered) {
            if (credentials.password === undefined) {
                output.inform('Account found, please sign in');
            }

            return form.signIn.handle({
                email: email,
                password: credentials.password,
            });
        }

        output.inform('New account, please sign up');

        return form.signUp.handle({email: email});
    }

    public logout(): Promise<void> {
        return Promise.resolve();
    }
}
