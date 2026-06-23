import {getImportSource} from '@/application/project/code/transformation/javascript/utils/getImportSource';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';

describe('getImportSource', () => {
    type Scenario = {
        description: string,
        code: string,
        importName: string | RegExp,
        expected: string | null,
    };

    it.each<Scenario>([
        {
            description: 'return null when there is no import',
            code: '<tsx/>',
            importName: 'sdk',
            expected: null,
        },
        {
            description: 'return null when no import matches the name',
            code: "import {sdk} from 'croct';",
            importName: 'something',
            expected: null,
        },
        {
            description: 'return the source of a named import',
            code: "import {createAppLoadContext} from '~/lib/context';",
            importName: 'createAppLoadContext',
            expected: '~/lib/context',
        },
        {
            description: 'match the imported name, not the local alias',
            code: "import {createAppLoadContext as build} from '~/lib/context';",
            importName: 'createAppLoadContext',
            expected: '~/lib/context',
        },
        {
            description: 'match a literal named import',
            code: "import {'createContext' as build} from '~/lib/context';",
            importName: 'createContext',
            expected: '~/lib/context',
        },
        {
            description: 'match a default import against `default`',
            code: "import sdk from 'croct';",
            importName: 'default',
            expected: 'croct',
        },
        {
            description: 'match a namespace import against `*`',
            code: "import * as sdk from 'croct';",
            importName: '*',
            expected: 'croct',
        },
        {
            description: 'match the imported name by regex',
            code: "import {createHydrogenRouterContext} from '~/lib/context';",
            importName: /^create[A-Za-z]*Context$/,
            expected: '~/lib/context',
        },
        {
            description: 'return the first matching import source',
            code: "import type {AppLoadContext} from '@shopify/remix-oxygen';\n"
                + "import {createAppLoadContext} from '~/lib/context';",
            importName: /^create[A-Za-z]*Context$/,
            expected: '~/lib/context',
        },
    ])('should $description', ({code, importName, expected}) => {
        expect(getImportSource(code, importName)).toBe(expected);
    });

    it('should accept an already-parsed AST', () => {
        const ast = parse("import {sdk} from 'croct';", ['typescript']);

        expect(getImportSource(ast, 'sdk')).toBe('croct');
    });
});
