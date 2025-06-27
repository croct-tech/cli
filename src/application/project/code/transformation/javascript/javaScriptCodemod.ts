import {File} from '@babel/types';
import {parse, print} from 'recast';
import {parse as babelParser} from 'recast/parsers/babel-ts.js';
import {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {Language} from '@/application/project/code/transformation/javascript/utils/parse';

export type Configuration<O extends CodemodOptions> = {
    codemod: Codemod<File, O>,
    languages: Language[],
};

export class JavaScriptCodemod<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly codemod: Codemod<File, O>;

    public constructor(configuration: Configuration<O>) {
        this.codemod = configuration.codemod;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        const ast = parse(input, {
            parser: {
                parse: babelParser,
            },
        });

        const result = await this.codemod.apply(ast, options);

        if (!result.modified) {
            return {
                modified: false,
                result: input,
            };
        }

        return {
            modified: true,
            result: print(result.result, {
                reuseWhitespace: false,
            }).code,
        };
    }
}
