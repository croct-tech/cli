import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {EmailInput} from '@/application/cli/form/input/emailInput';
import {UserApi} from '@/application/api/user';
import {PasswordInput} from '@/application/cli/form/input/passwordInput';
import {AuthenticationListener, Token} from '@/application/cli/authentication/authentication';
import {AccessDeniedReason, ApiError} from '@/application/api/error';

type LinkGenerator = (email: string) => Promise<URL|null>;

export type Configuration = {
    input: Input,
    output: Output,
    userApi: UserApi,
    listener: AuthenticationListener,
    emailLinkGenerator: {
        verification: LinkGenerator,
        recovery: LinkGenerator,
    },
};

export type SignInOptions = {
    email?: string,
    password?: string,
};

enum Action {
    RETRY_PASSWORD = 'retry-password',
    RESET_PASSWORD = 'reset-password',
    RETRY_ACTIVATION = 'retry-activation',
    CANCEL = 'cancel',
}

export class SignInForm implements Form<Token, SignInOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: SignInOptions): Promise<Token> {
        const email = options.email ?? await EmailInput.prompt({
            input: this.config.input,
            label: 'Enter your email',
        });

        return this.login(email, options.password);
    }

    private async login(email: string, password?: string): Promise<Token> {
        const {input, output, userApi} = this.config;

        let action = Action.RETRY_PASSWORD;

        let initialPassword = password;

        while (action === Action.RETRY_PASSWORD) {
            const enteredPassword = initialPassword ?? await PasswordInput.prompt({
                input: input,
                label: 'Password',
            });

            initialPassword = undefined;

            const notifier = output.notify('Checking credentials');

            try {
                const token = await userApi.issueToken({
                    email: email,
                    password: enteredPassword,
                });

                notifier.confirm('Logged in');

                return token;
            } catch (error) {
                if (error instanceof ApiError) {
                    if (error.isAccessDenied(AccessDeniedReason.UNVERIFIED_USER)) {
                        notifier.alert('Email not verified');

                        const retry = await input.confirm({
                            message: 'Resend activation link?',
                            default: true,
                        });

                        action = retry ? Action.RETRY_ACTIVATION : Action.CANCEL;

                        continue;
                    }

                    if (error.isAccessDenied(AccessDeniedReason.BAD_CREDENTIALS)) {
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
            case Action.RETRY_ACTIVATION:
                return this.retryActivation(email);

            case Action.RESET_PASSWORD:
                return this.resetPassword(email);

            case Action.CANCEL:
            default:
                return output.exit();
        }
    }

    private async retryActivation(email: string): Promise<string> {
        const {output, userApi, emailLinkGenerator: {verification: generateLink}} = this.config;

        const notifier = output.notify('Sending email');

        const sessionId = await userApi.createSession();

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

        const sessionId = await userApi.createSession();

        await userApi.resetPassword({
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
