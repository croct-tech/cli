import {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/codemod/codemod';
import {CodeFormatter} from '@/application/project/code/formatter/formatter';

export class FormatCode<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly codemod: Codemod<string, O>;

    private readonly formatter: CodeFormatter;

    public constructor(codemod: Codemod<string, O>, formatter: CodeFormatter) {
        this.codemod = codemod;
        this.formatter = formatter;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        const result = await this.codemod.apply(input, options);

        if (result.modified) {
            await this.formatter.format([input]);
        }

        return result;
    }
}
