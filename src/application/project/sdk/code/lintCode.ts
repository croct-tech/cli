import {Codemod, CodemodOptions, ResultCode} from '@/application/project/sdk/code/codemod';
import {Linter} from '@/application/project/linter';

export class LintCode<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly codemod: Codemod<string, O>;

    private readonly linter: Linter;

    public constructor(codemod: Codemod<string, O>, linter: Linter) {
        this.codemod = codemod;
        this.linter = linter;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        const result = await this.codemod.apply(input, options);

        if (result.modified) {
            await this.linter.fix([input]);
        }

        return result;
    }
}
