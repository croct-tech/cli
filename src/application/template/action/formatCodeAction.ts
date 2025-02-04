import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {CodeFormatter} from '@/application/project/code/formatter/formatter';

export type FormatCodeOptions = {
    files: string[],
};

export type Configuration = {
    formatter: CodeFormatter,
};

export class FormatCodeAction implements Action<FormatCodeOptions> {
    private readonly formatter: CodeFormatter;

    public constructor({formatter}: Configuration) {
        this.formatter = formatter;
    }

    public async execute(options: FormatCodeOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output.notify('Formatting code');

        try {
            await this.formatter.format(options.files);
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier.stop();
        }
    }
}
