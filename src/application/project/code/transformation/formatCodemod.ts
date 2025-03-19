import {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {CodeFormatter} from '@/application/project/code/formatting/formatter';

export class FormatCodemod<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly formatter: CodeFormatter;

    private readonly codemod?: Codemod<string, O>;

    public constructor(formatter: CodeFormatter, codemod?: Codemod<string, O>) {
        this.codemod = codemod;
        this.formatter = formatter;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        if (this.codemod === undefined) {
            await this.formatter.format([input]);

            return {
                modified: true,
                result: input,
            };
        }

        const result = await this.codemod.apply(input, options);

        if (result.modified) {
            await this.formatter.format([input]);
        }

        return result;
    }
}
