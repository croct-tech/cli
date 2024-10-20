import type {namedTypes as Ast} from 'ast-types';
import {print} from 'recast';
import {Codemod, CodemodOptions, ResultCode} from '@/application/project/sdk/code/codemod';
import {Language, parse} from '@/application/project/sdk/code/parser';

export type Configuration<O extends CodemodOptions> = {
    codemod: Codemod<Ast.Node, O>,
    languages: Language[],
};

export class ParseCode<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly codemod: Codemod<Ast.Node, O>;

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
            result: print(result.result).code,
        };
    }
}
