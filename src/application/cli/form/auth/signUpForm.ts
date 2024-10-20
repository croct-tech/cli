import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Expertise} from '@/application/model/entities';
import {Form} from '@/application/cli/form/form';
import {EmailInput} from '@/application/cli/form/input/emailInput';
import {UserApi} from '@/application/api/user';
import {PasswordInput} from '@/application/cli/form/input/passwordInput';
import {NameInput} from '@/application/cli/form/input/nameInput';
import {AuthenticationListener, Token} from '@/application/cli/authentication/authentication';

export type Configuration = {
    input: Input,
    output: Output,
    userApi: UserApi,
    listener: AuthenticationListener,
};

export type SignUpOptions = {
    email?: string,
    expertise?: Expertise,
};

export class SignUpForm implements Form<Token, SignUpOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: SignUpOptions): Promise<Token> {
        const {input, output, listener, userApi} = this.config;

        const name = await NameInput.prompt({
            input: input,
            minimumLength: 2,
            maximumLength: 30,
            label: 'Name',
        });

        const [firstName, lastName] = name.replace(/\s+/g, ' ')
            .trim()
            .split(' ');

        const email = options.email ?? await EmailInput.prompt({
            input: input,
            label: 'Email',
        });

        const password = await PasswordInput.prompt({
            input: input,
            label: 'Password',
            validator: (value: string): string | boolean => {
                if (!/[A-Z]/.test(value)) {
                    return 'Must contain an uppercase letter';
                }

                if (!/[a-z]/.test(value)) {
                    return 'Must contain a lowercase letter';
                }

                if (!/[^A-Za-z]/.test(value)) {
                    return 'Must contain a special character';
                }

                if (value.length < 8) {
                    return 'Minimum of 8 characters';
                }

                if (value.length > 256) {
                    return 'Maximum of 256 characters';
                }

                return true;
            },
        });

        const sessionId = userApi.createSession();

        return output.monitor(
            resolve => ({
                tasks: [
                    {
                        title: 'Creating account',
                        task: async (notifier): Promise<void> => {
                            await userApi.registerUser({
                                sessionId: await sessionId,
                                email: email,
                                password: password,
                                firstName: firstName,
                                lastName: lastName,
                                expertise: options.expertise ?? Expertise.ENGINEERING,
                            });

                            notifier.confirm('Account created, check your email for confirmation');
                        },
                    },
                    {
                        title: 'Waiting for confirmation',
                        task: async (notifier): Promise<void> => {
                            const token = await listener.wait(await sessionId);

                            notifier.confirm('Account confirmed');

                            resolve(token);
                        },
                    },
                ],
            }),
        );
    }
}
