import {Form} from '@/application/cli/form/form';
import {Input} from '@/application/cli/io/input';

export type Configuration = {
    input: Input,
    label: string,
    default?: string,
    unavailableSlugs?: string[],
};

export class SlugInput implements Form<string> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public static prompt(config: Configuration): Promise<string> {
        return new SlugInput(config).handle();
    }

    public handle(): Promise<string> {
        const {input, unavailableSlugs = [], default: defaultValue} = this.config;

        return input.prompt({
            message: this.config.label,
            default: defaultValue,
            validate: value => {
                if (!/^[a-z]+(-?[a-z0-9]+)*$/i.test(value)) {
                    return 'The slug must start with a letter and contain only letters, numbers, and hyphens.';
                }

                if (unavailableSlugs.includes(value)) {
                    return 'The entered slug is already in use.';
                }

                return true;
            },
        });
    }
}
