import {Form} from '@/application/cli/form/form';
import {Input} from '@/application/cli/io/input';

export type Configuration = {
    input: Input,
    label: string,
};

export class EmailInput implements Form<string> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public static prompt(config: Configuration): Promise<string> {
        return new EmailInput(config).handle();
    }

    public handle(): Promise<string> {
        const {input} = this.config;

        return input.prompt({
            message: this.config.label,
            validate: (value: string): string | boolean => {
                if (value.length > 255) {
                    return 'The email must be less than 255 characters';
                }

                if (!/^([A-Z0-9_+-]+\.?)*[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i.test(value)) {
                    return 'Please enter a valid email';
                }

                return true;
            },
        });
    }
}
