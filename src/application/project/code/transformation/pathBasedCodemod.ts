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

    public apply(input: string, options?: O): Promise<ResultCode<string>> {
        const [, codemod] = Object.entries(this.codemods)
            .find(([pattern]) => minimatch(input, pattern)) ?? [];

        if (codemod === undefined) {
            return Promise.resolve({
                modified: false,
                result: input,
            });
        }

        return codemod.apply(input, options);
    }
}
