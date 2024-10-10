import {Form} from '@/application/cli/form/form';
import {Input} from '@/application/cli/io/input';

export type Configuration = {
    input: Input,
    label: string,
    default?: string,
};

export class UrlInput implements Form<string> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public static prompt(config: Configuration): Promise<string> {
        return new UrlInput(config).handle();
    }

    public handle(): Promise<string> {
        const {input} = this.config;

        return input.prompt({
            message: this.config.label,
            default: this.config.default ?? 'https://',
            validate: value => {
                if (!URL.canParse(value)) {
                    return 'Invalid URL';
                }

                return true;
            },
        });
    }
}
