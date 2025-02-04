import {Node} from '@babel/types';
import generate from '@babel/generator';
import {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/codemod/codemod';
import {Language, parse} from '@/application/project/code/codemod/parser';

export type Configuration<O extends CodemodOptions> = {
    codemod: Codemod<Node, O>,
    languages: Language[],
};

export class ParseCode<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly codemod: Codemod<Node, O>;

    private readonly languages: Language[];

    public constructor(configuration: Configuration<O>) {
        this.codemod = configuration.codemod;
        this.languages = configuration.languages;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        const result = await this.codemod.apply(parse(input, this.languages), options);

        if (!result.modified) {
            return {
                modified: false,
                result: input,
            };
        }

        return {
            modified: true,
            result: generate(
                result.result,
                {
                    compact: false,
                    retainFunctionParens: true,
                },
            ).code,
        };
    }
}
