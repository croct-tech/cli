import {File} from '@babel/types';
import {parse, print} from 'recast';
import {parse as babelParse} from '@babel/parser';
import getBabelOptionsModule from 'recast/parsers/_babel_options.js';
import type {Overrides} from 'recast/parsers/_babel_options.js';
import {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {Language} from '@/application/project/code/transformation/javascript/utils/parse';

export type Configuration<O extends CodemodOptions> = {
    codemod: Codemod<File, O>,
    languages: Language[],
};

// This is a workaround mixed ESM and CommonJS modules that causes issues
// when bundling the recast package.
const getBabelOptions = 'default' in getBabelOptionsModule
    ? getBabelOptionsModule.default as typeof getBabelOptionsModule
    : getBabelOptionsModule;

export class JavaScriptCodemod<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly codemod: Codemod<File, O>;

    public constructor(configuration: Configuration<O>) {
        this.codemod = configuration.codemod;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        const ast = parse(input, {
            parser: {
                parse: (source: string, parseOptions?: Overrides) => {
                    const babelOptions = getBabelOptions(parseOptions);

                    babelOptions.plugins.push('jsx', 'typescript');

                    return babelParse(source, babelOptions);
                },
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
