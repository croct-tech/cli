import generate from '@babel/generator';
import {cloneNode, isNodesEquivalent} from '@babel/types';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';
import {
    ImportDeclaration,
    ImportTransformer,
    transformImports,
} from '@/application/project/code/transformation/javascript/utils/transformImports';

describe('transformImports', () => {
    type Scenario = {
        description: string,
        transformer: ImportTransformer,
        code: string,
        result: string,
        calls: ImportDeclaration[],
    };

    it.each<Scenario>([
        {
            description: 'transform named imports',
            transformer: (declaration): string|void => (declaration.source === 'module' ? 'module-x' : undefined),
            code: "import {foo, bar} from 'module';",
            result: 'import { foo, bar } from "module-x";',
            calls: [
                {
                    source: 'module',
                    names: ['foo', 'bar'],
                },
            ],
        },
        {
            description: 'transform namespace imports',
            transformer: (declaration): string|void => (declaration.source === 'module' ? 'module-x' : undefined),
            code: "import * as foo from 'module';",
            result: 'import * as foo from "module-x";',
            calls: [
                {
                    source: 'module',
                    names: [],
                },
            ],
        },
        {
            description: 'not change the import',
            transformer: (): void => {},
            code: "import foo from 'module';",
            result: "import foo from 'module';",
            calls: [
                {
                    source: 'module',
                    names: [],
                },
            ],
        },
        {
            description: 'should transform only the matched imports',
            transformer: (declaration): string|void => (declaration.source === 'module-b' ? 'module-x' : undefined),
            code: "import a from 'module-a';\nimport b from 'module-b';\nimport c from 'module-c';",
            result: "import a from 'module-a';\nimport b from \"module-x\";\nimport c from 'module-c';",
            calls: [
                {
                    source: 'module-a',
                    names: [],
                },
                {
                    source: 'module-b',
                    names: [],
                },
                {
                    source: 'module-c',
                    names: [],
                },
            ],
        },
        {
            description: 'await for async transformers',
            transformer: (declaration): Promise<string> => Promise.resolve(`${declaration.source}-x`),
            code: "import {foo, bar} from 'module';\nimport * as baz from 'module';",
            result: 'import { foo, bar } from "module-x";\nimport * as baz from "module-x";',
            calls: [
                {
                    source: 'module',
                    names: ['foo', 'bar'],
                },
                {
                    source: 'module',
                    names: [],
                },
            ],
        },
        {
            description: 'detect changes in async transformers',
            transformer: (): Promise<void> => Promise.resolve(),
            code: "import {foo} from 'module';",
            result: "import { foo } from 'module';",
            calls: [
                {
                    source: 'module',
                    names: ['foo'],
                },
            ],
        },
    ])('should $description', async ({code, result, transformer, calls}) => {
        const ast = parse(code, ['typescript']);
        const modifiedAst = cloneNode(ast, true);

        const spy = jest.fn(transformer);
        const modified = await transformImports(modifiedAst, spy);

        expect(spy).toHaveBeenCalledTimes(calls.length);

        for (let index = 0; index < calls.length; index++) {
            expect(spy).toHaveBeenNthCalledWith(index + 1, calls[index]);
        }

        const foo = isNodesEquivalent(ast, modifiedAst);

        expect(generate(modifiedAst).code).toEqual(result);
        expect(foo).toBe(!modified);
    });
});
