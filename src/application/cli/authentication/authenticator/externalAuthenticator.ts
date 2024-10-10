import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {UserApi} from '@/application/api/user';
import {Token} from '@/application/cli/authentication/authentication';
import {Authenticator} from '@/application/cli/authentication/authenticator/index';
import {Form} from '@/application/cli/form/form';
import {SignInOptions} from '@/application/cli/form/auth/signInForm';
import {SignUpOptions} from '@/application/cli/form/auth/signUpForm';
import {EmailInput} from '@/application/cli/form/input/emailInput';

export type ExternalAuthenticatorConfig = {
    input: Input,
    output: Output,
    userApi: UserApi,
    form: {
        signIn: Form<Token, SignInOptions>,
        signUp: Form<Token, SignUpOptions>,
    },
};

export class ExternalAuthenticator implements Authenticator {
    private readonly config: ExternalAuthenticatorConfig;

    public constructor(config: ExternalAuthenticatorConfig) {
        this.config = config;
    }

    public getToken(): Promise<string | null> {
        return Promise.resolve(null);
    }

    public async login(): Promise<Token> {
        const {input, output, userApi, form} = this.config;

        const email = await EmailInput.prompt({
            input: input,
            label: 'Enter your email',
        });

        const spinner = output.createSpinner('Checking email');

        const isRegistered = await userApi.isEmailRegistered(email);

        spinner.stop();

        if (isRegistered) {
            output.info('Existing user, please sign in:');

            return form.signIn.handle({email: email});
        }

        output.info('New user, please sign up:');

        return form.signUp.handle({email: email});
    }

    public logout(): Promise<void> {
        return Promise.resolve();
    }
}
