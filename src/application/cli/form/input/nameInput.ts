import {Form} from '@/application/cli/form/form';
import {Input} from '@/application/cli/io/input';

export type Configuration = {
    input: Input,
    label: string,
    default?: string,
    minimumLength?: number,
    maximumLength?: number,
    validator?: (value: string) => string | boolean,
};

export class NameInput implements Form<string> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public static prompt(config: Configuration): Promise<string> {
        return new NameInput(config).handle();
    }

    public handle(): Promise<string> {
        const {input, validator, minimumLength = 2, maximumLength = 30} = this.config;

        return input.prompt({
            message: this.config.label,
            default: this.config.default,
            validate: value => {
                if (/(^\s|\s$|\s{2,})/.test(value)) {
                    return 'No leading, trailing, or multiple spaces.';
                }

                if (value.length < minimumLength) {
                    return `Minimum of ${minimumLength} characters`;
                }

                if (value.length > maximumLength) {
                    return `Maximum of ${maximumLength} characters`;
                }

                return validator?.(value) ?? true;
            },
        });
    }
}
