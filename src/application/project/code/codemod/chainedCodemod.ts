import {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/codemod/codemod';

export class ChainedCodemod<I, O extends CodemodOptions> implements Codemod<I, O> {
    private readonly codemods: Array<Codemod<I, O>>;

    public constructor(...codemods: Array<Codemod<I, O>>) {
        this.codemods = codemods;
    }

    public async apply(input: I, options?: O): Promise<ResultCode<I>> {
        let result: I = input;
        let modified = false;

        for (const codemod of this.codemods) {
            const currentResult = await codemod.apply(result, options);

            result = currentResult.result;
            modified = modified || currentResult.modified;
        }

        return {
            modified: modified,
            result: result,
        };
    }
}
