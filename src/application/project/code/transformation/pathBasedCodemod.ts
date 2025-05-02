import {minimatch} from 'minimatch';
import {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';

export type Configuration<O extends CodemodOptions> = {
    codemods: Record<string, Codemod<string, O>>,
};

export class PathBasedCodemod<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly codemods: Record<string, Codemod<string, O>>;

    public constructor({codemods}: Configuration<O>) {
        this.codemods = codemods;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        let result: ResultCode<string> = {
            modified: false,
            result: input,
        };

        for (const [pattern, codemod] of Object.entries(this.codemods)) {
            if (minimatch(input, pattern)) {
                result = await codemod.apply(input, options);
            }
        }

        return result;
    }
}
