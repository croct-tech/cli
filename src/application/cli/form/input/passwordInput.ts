import {Form} from '@/application/cli/form/form';
import {Input} from '@/application/cli/io/input';

export type Configuration = {
    label: string,
    input: Input,
    validator?: (value: string) => string | boolean,
};

export class PasswordInput implements Form<string> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public static prompt(config: Configuration): Promise<string> {
        return new PasswordInput(config).handle();
    }

    public handle(): Promise<string> {
        const {input} = this.config;

        return input.prompt({
            message: this.config.label,
            type: 'password',
            validate: this.config.validator ?? ((value: string): string | boolean => (
                value.length > 0 ? true : 'Please enter your password'
            )),
        });
    }
}
