import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {UserApi} from '@/application/api/user';
import {Token} from '@/application/cli/authentication/authentication';
import {Authenticator} from '@/application/cli/authentication/authenticator/index';
import {Form} from '@/application/cli/form/form';
import {SignInOptions} from '@/application/cli/form/auth/signInForm';
import {SignUpOptions} from '@/application/cli/form/auth/signUpForm';
import {EmailInput} from '@/application/cli/form/input/emailInput';
import {AccessDeniedReason, ApiError} from '@/application/api/error';

import {HelpfulError, ErrorReason} from '@/application/error';

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

    public async login(credentials: CredentialsInput = {}): Promise<Token> {
        if (credentials.username === undefined || credentials.password === undefined) {
            return this.loginInteractively(credentials);
        }

        const {output, userApi} = this.config;

        const notifier = output.notify('Checking credentials');

        try {
            const token = await userApi.issueToken({
                email: credentials.username,
                password: credentials.password,
            });

            notifier.confirm('Logged in');

            return token;
        } catch (error) {
            if (error instanceof ApiError) {
                if (error.isAccessDenied(AccessDeniedReason.UNVERIFIED_USER)) {
                    throw new HelpfulError('Email not verified', {
                        reason: ErrorReason.ACCESS_DENIED,
                        cause: error,
                        suggestions: ['Access your email and click on the activation link'],
                    });
                }

                if (error.isAccessDenied(AccessDeniedReason.BAD_CREDENTIALS)) {
                    throw new HelpfulError('Username or password is incorrect', {
                        reason: ErrorReason.ACCESS_DENIED,
                        cause: error,
                        suggestions: ['Check your credentials or reset your password'],
                    });
                }
            }

            throw error;
        } finally {
            notifier.stop();
        }
    }

    private async loginInteractively(credentials: CredentialsInput): Promise<Token> {
        const {input, output, userApi, form} = this.config;

        const email = credentials.username ?? await EmailInput.prompt({
            input: input,
            label: 'Enter your email',
        });

        const notifier = output.notify('Checking email');

        const isRegistered = await userApi.isEmailRegistered(email);

        notifier.stop();

        if (isRegistered) {
            if (credentials.password === undefined) {
                output.inform('Existing user, please sign in');
            }

            return form.signIn.handle({
                email: email,
                password: credentials.password,
            });
        }

        output.inform('New user, please sign up');

        return form.signUp.handle({email: email});
    }

    public logout(): Promise<void> {
        return Promise.resolve();
    }
}
