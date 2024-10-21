import {Codemod, CodemodOptions, ResultCode} from '@/application/project/sdk/code/codemod';

export class AlternativelyApply<T, O extends CodemodOptions> implements Codemod<T, O> {
    private readonly codemods: Array<Codemod<T, O>>;

    public constructor(codemod: Codemod<T, O>, ...codemods: Array<Codemod<T, O>>) {
        this.codemods = [codemod, ...codemods];
    }

    public async apply(input: T, options?: O): Promise<ResultCode<T>> {
        for (const codemod of this.codemods) {
            const result = await codemod.apply(input, options);

            if (result.modified) {
                return result;
            }
        }

        return {
            modified: false,
            result: input,
        };
    }
}
