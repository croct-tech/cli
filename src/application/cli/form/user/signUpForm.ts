import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {EmailInput} from '@/application/cli/form/input/emailInput';
import {UserApi} from '@/application/api/user';
import {PasswordInput} from '@/application/cli/form/input/passwordInput';
import {NameInput} from '@/application/cli/form/input/nameInput';
import {AuthenticationListener} from '@/application/cli/authentication/authentication';
import {Expertise} from '@/application/model/user';

type LinkGenerator = (email: string) => Promise<URL|null>;

export type Configuration = {
    input: Input,
    output: Output,
    userApi: UserApi,
    listener: AuthenticationListener,
    emailLinkGenerator: LinkGenerator,
    verificationLinkDestination: string,
};

export type SignUpOptions = {
    email?: string,
    expertise?: Expertise,
};

export class SignUpForm implements Form<string, SignUpOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: SignUpOptions): Promise<string> {
        const {input, output, listener, userApi} = this.config;

        output.inform(
            '*By continuing, you agree to our '
            + '[Terms of Use](https://croct.link/terms-of-use) and '
            + '[Privacy Policy](https://croct.link/privacy)*',
        );

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

        const sessionId = userApi.createSession({
            destination: this.config.verificationLinkDestination,
        });

        let notifier = output.notify('Creating account');

        await userApi.registerUser({
            sessionId: await sessionId,
            email: email,
            password: password,
            firstName: firstName,
            lastName: lastName,
            expertise: options.expertise ?? Expertise.ENGINEERING,
        });

        notifier.confirm(`Link to verify sent to \`${email}\``);

        const link = await this.config
            .emailLinkGenerator(email)
            .then(async inboxLink => {
                if (inboxLink !== null && await input.confirm({message: 'Open your inbox?', default: true})) {
                    return inboxLink.toString();
                }

                return null;
            });

        notifier = output.notify('Waiting for account activation');

        // Start the listener before opening the link to allow external
        // listeners to capture the current window
        const verification = listener.wait(await sessionId);

        if (link !== null) {
            await output.open(link);
        }

        const token = await verification;

        notifier.confirm('Account activated');

        return token;
    }
}
