import generate from '@babel/generator';
import {cloneNode, File, isNodesEquivalent} from '@babel/types';
import traverse from '@babel/traverse';
import {
    addImport,
    ImportDeclaration,
    ImportResult,
} from '@/application/project/code/transformation/javascript/utils/addImport';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';

describe('addImport', () => {
    type Scenario = {
        description: string,
        code: string,
        declaration: ImportDeclaration,
        expected: ImportResult & {
            code: string,
        },
    };

    it.each<Scenario>([
        {
            description: 'add a new value import',
            code: '',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import { sdk } from "croct";',
            },
        },
        {
            description: 'add a new aliased value import',
            code: '',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
                localName: 'alias',
            },
            expected: {
                modified: true,
                localName: 'alias',
                code: 'import { sdk as alias } from "croct";',
            },
        },
        {
            description: 'add a new type import',
            code: '',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import type { sdk } from "croct";',
            },
        },
        {
            description: 'add a new aliased type import',
            code: '',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
                localName: 'alias',
            },
            expected: {
                modified: true,
                localName: 'alias',
                code: 'import type { sdk as alias } from "croct";',
            },
        },
        {
            description: 'add a new value import to an existing value import',
            code: 'import { other } from "croct";',
            declaration: {
                importName: 'sdk',
                type: 'value',
                moduleName: 'croct',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import { other, sdk } from "croct";',
            },
        },
        {
            description: 'add a new value import to an existing type import',
            code: 'import type { other } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import { type other, sdk } from "croct";',
            },
        },
        {
            description: 'add a new type import to an existing type import',
            code: 'import type { other } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import type { other, sdk } from "croct";',
            },
        },
        {
            description: 'add a new type import to an existing value import',
            code: 'import { other } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import { other, type sdk } from "croct";',
            },
        },
        {
            description: 'add a new value import to an existing default import',
            code: 'import croct from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import croct, { sdk } from "croct";',
            },
        },
        {
            description: 'add a new type import to an existing default import',
            code: 'import croct from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import croct, { type sdk } from "croct";',
            },
        },
        {
            description: 'transform a type import into a value import',
            code: 'import type { sdk, something } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import { sdk, type something } from "croct";',
            },
        },
        {
            description: 'transform a type specifier import into a value import',
            code: 'import { type sdk } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: true,
                localName: 'sdk',
                code: 'import { sdk } from "croct";',
            },
        },

        {
            description: 'reuse an existing value import',
            code: 'import { sdk } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: false,
                localName: 'sdk',
                code: 'import { sdk } from "croct";',
            },
        },
        {
            description: 'reuse an existing aliased value import',
            code: 'import { sdk as alias } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: false,
                localName: 'alias',
                code: 'import { sdk as alias } from "croct";',
            },
        },
        {
            description: 'reuse an existing type import',
            code: 'import type { sdk } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: false,
                localName: 'sdk',
                code: 'import type { sdk } from "croct";',
            },
        },
        {
            description: 'reuse an existing aliased type import',
            code: 'import type { sdk as alias } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: false,
                localName: 'alias',
                code: 'import type { sdk as alias } from "croct";',
            },
        },
        {
            description: 'reuse an existing type specifier import',
            code: 'import { type sdk } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: false,
                localName: 'sdk',
                code: 'import { type sdk } from "croct";',
            },
        },
        {
            description: 'reuse an existing aliased type specifier import',
            code: 'import { type sdk as alias } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: {
                modified: false,
                localName: 'alias',
                code: 'import { type sdk as alias } from "croct";',
            },
        },
        {
            description: 'modify the most specific import',
            code: 'import { somethingElse } from "croct";\nimport type { something } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'something',
            },
            expected: {
                modified: true,
                localName: 'something',
                code: 'import { somethingElse } from "croct";\nimport { something } from "croct";',
            },
        },
    ])('should $description', ({code, declaration, expected}) => {
        const ast = parse(code, ['typescript']);
        const parsedAst = cloneNode(ast, true);
        const modifiedAst = cloneNode(parsedAst, true);

        clearImportKind(modifiedAst);

        const parsedResult: Scenario['expected'] = {
            ...addImport(parsedAst, declaration),
            code: generate(parsedAst).code,
        };

        // Ensure the result when the specifiers are null,
        // which happen when adding a new import programmatically
        const modifiedResult: Scenario['expected'] = {
            ...addImport(modifiedAst, declaration),
            code: generate(modifiedAst).code,
        };

        expect(parsedResult).toEqual(expected);
        expect(modifiedResult).toEqual(expected);
        expect(isNodesEquivalent(ast, parsedAst)).toBe(!expected.modified);
    });

    function clearImportKind(file: File): void {
        traverse(file, {
            ImportSpecifier: function accept(path) {
                if (path.node.importKind === 'value') {
                    // eslint-disable-next-line no-param-reassign -- In place mutation is required
                    path.node.importKind = null;
                }
            },
            ImportDeclaration: function accept(path) {
                if (path.node.importKind === 'value') {
                    // eslint-disable-next-line no-param-reassign -- In place mutation is required
                    path.node.importKind = null;
                }
            },
        });
    }
});
