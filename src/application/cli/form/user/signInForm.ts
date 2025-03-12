import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {EmailInput} from '@/application/cli/form/input/emailInput';
import {UserApi} from '@/application/api/user';
import {PasswordInput} from '@/application/cli/form/input/passwordInput';
import {AuthenticationListener} from '@/application/cli/authentication/authentication';
import {AccessDeniedReason, ApiError} from '@/application/api/error';
import {ErrorReason, HelpfulError} from '@/application/error';

type LinkGenerator = (email: string) => Promise<URL|null>;

export type Configuration = {
    input: Input,
    output: Output,
    userApi: UserApi,
    listener: AuthenticationListener,
    tokenDuration: number,
    emailLinkGenerator: {
        verification: LinkGenerator,
        recovery: LinkGenerator,
    },
    verificationLinkDestination: {
        passwordReset: string,
        accountActivation: string,
    },
};

export type SignInOptions = {
    email?: string,
    password?: string,
    retry?: boolean,
};

enum Action {
    RETRY_PASSWORD = 'retry-password',
    RESET_PASSWORD = 'reset-password',
    RETRY_ACTIVATION = 'retry-activation',
    CHANGE_EMAIL = 'change-email',
    CANCEL = 'cancel',
}

export class SignInForm implements Form<string, SignInOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public handle(options: SignInOptions): Promise<string> {
        return this.login(options.email, options.password, options.retry);
    }

    private async login(email?: string, password?: string, retry = false): Promise<string> {
        const {input, output, userApi} = this.config;

        const enteredEmail = email ?? await EmailInput.prompt({
            input: this.config.input,
            label: 'Enter your email',
        });

        let initialPassword = password;
        let action = Action.RETRY_PASSWORD;

        while (action === Action.RETRY_PASSWORD) {
            const enteredPassword = initialPassword ?? await PasswordInput.prompt({
                input: input,
                label: 'Password',
            });

            initialPassword = undefined;

            const notifier = output.notify('Checking credentials');

            try {
                const token = await userApi.signIn({
                    email: enteredEmail,
                    password: enteredPassword,
                    duration: this.config.tokenDuration,
                });

                notifier.confirm('Logged in');

                return token;
            } catch (error) {
                if (error instanceof ApiError) {
                    if (error.isAccessDenied(AccessDeniedReason.UNVERIFIED_USER)) {
                        if (!retry) {
                            throw new HelpfulError('Email not verified.', {
                                reason: ErrorReason.ACCESS_DENIED,
                                cause: error,
                                suggestions: ['Access your email and click on the activation link'],
                            });
                        }

                        notifier.warn('Email not verified');

                        const resend = await input.confirm({
                            message: 'Resend activation link?',
                            default: true,
                        });

                        action = resend ? Action.RETRY_ACTIVATION : Action.CANCEL;

                        continue;
                    }

                    if (error.isAccessDenied(AccessDeniedReason.BAD_CREDENTIALS)) {
                        if (!retry) {
                            throw new HelpfulError('Username or password is incorrect.', {
                                reason: ErrorReason.ACCESS_DENIED,
                                cause: error,
                                suggestions: ['Check your credentials or reset your password'],
                            });
                        }

                        notifier.alert('Wrong password');

                        action = await input.select<Action>({
                            message: 'What would you like to do?',
                            default: Action.RETRY_PASSWORD,
                            options: [
                                {
                                    label: 'Try again',
                                    value: Action.RETRY_PASSWORD,
                                },
                                {
                                    label: 'Recover password',
                                    value: Action.RESET_PASSWORD,
                                },
                                ...(
                                    email === undefined
                                        ? [{
                                            label: 'Enter a different email',
                                            value: Action.CHANGE_EMAIL,
                                        }]
                                        : []
                                ),
                                {
                                    label: 'Cancel',
                                    value: Action.CANCEL,
                                },
                            ],
                        });

                        continue;
                    }
                }

                notifier.stop();

                throw error;
            }
        }

        switch (action) {
            case Action.CHANGE_EMAIL:
                return this.login();

            case Action.RETRY_ACTIVATION:
                return this.retryActivation(enteredEmail);

            case Action.RESET_PASSWORD:
                return this.resetPassword(enteredEmail);

            case Action.CANCEL:
            default:
                return output.exit();
        }
    }

    private async retryActivation(email: string): Promise<string> {
        const {output, userApi, emailLinkGenerator: {verification: generateLink}} = this.config;

        const notifier = output.notify('Sending email');

        const sessionId = await userApi.createSession({
            destination: this.config.verificationLinkDestination.accountActivation,
        });

        await userApi.retryActivation({
            email: email,
            sessionId: sessionId,
        });

        notifier.confirm(`Link sent to \`${email}\``);

        const link = await this.getInboxLink(generateLink, email);
        const promise = this.waitToken(sessionId);

        if (link !== null) {
            await output.open(link);
        }

        return promise;
    }

    private async resetPassword(email: string): Promise<string> {
        const {output, userApi, emailLinkGenerator: {recovery: generateLink}} = this.config;

        const notifier = output.notify('Sending link to reset password');

        const sessionId = await userApi.createSession({
            destination: this.config.verificationLinkDestination.passwordReset,
        });

        await userApi.requestPasswordReset({
            email: email,
            sessionId: sessionId,
        });

        notifier.confirm(`Link sent to \`${email}\``);

        const link = await this.getInboxLink(generateLink, email);

        // Start the listener before opening the link to allow external
        // listeners to capture the current window
        const verification = this.waitToken(sessionId);

        if (link !== null) {
            await output.open(link);
        }

        return userApi.resetPassword({
            token: await verification,
            password: await this.createPassword(),
        });
    }

    private async createPassword(): Promise<string> {
        const {input, output} = this.config;

        let password: string|null = null;

        while (password === null) {
            const enteredPassword = await PasswordInput.prompt({
                input: input,
                label: 'Enter your new password',
            });

            const confirmedPassword = await PasswordInput.prompt({
                input: input,
                label: 'Confirm your new password',
            });

            if (enteredPassword !== confirmedPassword) {
                output.warn('Passwords do not match, please try again');

                continue;
            }

            password = enteredPassword;
        }

        return password;
    }

    private async getInboxLink(generator: LinkGenerator, email: string): Promise<string|null> {
        const {input} = this.config;
        const link = await generator(email);

        if (link !== null && await input.confirm({message: 'Open your inbox?', default: true})) {
            return link.toString();
        }

        return null;
    }

    private async waitToken(sessionId: string): Promise<string> {
        const {output, listener} = this.config;

        const notifier = output.notify('Waiting for confirmation');

        const token = await listener.wait(sessionId);

        notifier.confirm('Login completed');

        return token;
    }
}
