import {Action} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {Linter} from '@/application/project/linter';
import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';

export type FormatCodeOptions = {
    files: string[],
};

export type Configuration = {
    linterProvider: ParameterlessProvider<Linter>,
};

export class FormatCodeAction implements Action<FormatCodeOptions> {
    private readonly linterProvider: ParameterlessProvider<Linter>;

    public constructor({linterProvider}: Configuration) {
        this.linterProvider = linterProvider;
    }

    public async execute(options: FormatCodeOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output.notify('Formatting code');

        try {
            const linter = await this.linterProvider.get();

            await linter.fix(options.files);
        } finally {
            notifier.stop();
        }
    }
}
