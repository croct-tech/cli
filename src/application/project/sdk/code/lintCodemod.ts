import {Codemod, ResultCode} from '@/application/project/sdk/code/transformation';
import {Linter} from '@/application/project/linter';

export class LintCodemod implements Codemod<string> {
    private readonly codemod: Codemod<string>;

    private readonly linter: Linter;

    public constructor(codemod: Codemod<string>, linter: Linter) {
        this.codemod = codemod;
        this.linter = linter;
    }

    public async apply(input: string): Promise<ResultCode<string>> {
        const result = await this.codemod.apply(input);

        if (result.modified) {
            await this.linter.fix([input]);
        }

        return result;
    }
}
