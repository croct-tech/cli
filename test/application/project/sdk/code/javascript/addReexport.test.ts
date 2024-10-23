import generate from '@babel/generator';
import {cloneNode, File, isNodesEquivalent} from '@babel/types';
import traverse from '@babel/traverse';
import {parse} from '@/application/project/sdk/code/parser';
import {addReexport, ExportDeclaration} from '@/application/project/sdk/code/javascript/addReexport';

describe('addReexport', () => {
    type Scenario = {
        description: string,
        code: string,
        declaration: ExportDeclaration,
        modified: boolean,
        result: string,
    };

    it.each<Scenario>([
        {
            description: 'add a new value wildcard export',
            code: '',
            declaration: {
                type: 'value',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export * from "croct";',
        },
        {
            description: 'add a new type wildcard export',
            code: '',
            declaration: {
                type: 'type',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export type * from "croct";',
        },
        {
            description: 'add a new value namespace export',
            code: '',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                exportName: 'all',
            },
            modified: true,
            result: 'export * as all from "croct";',
        },
        {
            description: 'add a new type namespace export',
            code: '',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                exportName: 'all',
            },
            modified: true,
            result: 'export type * as all from "croct";',
        },
        {
            description: 'add a new named value export',
            code: '',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'sdk',
            },
            modified: true,
            result: 'export { sdk } from "croct";',
        },
        {
            description: 'add a new named type export',
            code: '',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'sdk',
            },
            modified: true,
            result: 'export type { sdk } from "croct";',
        },
        {
            description: 'add a new aliased value export',
            code: '',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: true,
            result: 'export { sdk as alias } from "croct";',
        },
        {
            description: 'add a new aliased type export',
            code: '',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: true,
            result: 'export type { sdk as alias } from "croct";',
        },
        {
            description: 'reuse namespaced value export',
            code: 'export * as sdk from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                exportName: 'sdk',
            },
            modified: false,
            result: 'export * as sdk from "croct";',
        },
        {
            description: 'reuse namespaced value export exporting all types',
            code: 'export * as sdk from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                exportName: 'sdk',
            },
            modified: false,
            result: 'export * as sdk from "croct";',
        },
        {
            description: 'reuse namespaced type export exporting all types',
            code: 'export type * as sdk from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                exportName: 'sdk',
            },
            modified: false,
            result: 'export type * as sdk from "croct";',
        },
        {
            description: 'convert namespaced type export to value export',
            code: 'export type * as sdk from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                exportName: 'sdk',
            },
            modified: true,
            result: 'export * as sdk from "croct";',
        },
        {
            description: 'reuse an existing value wildcard export',
            code: 'export * from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
            },
            modified: false,
            result: 'export * from "croct";',
        },
        {
            description: 'reuse an existing value wildcard export to export all types',
            code: 'export * from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
            },
            modified: false,
            result: 'export * from "croct";',
        },
        {
            description: 'reuse an existing type wildcard export',
            code: 'export type * from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
            },
            modified: false,
            result: 'export type * from "croct";',
        },
        {
            description: 'reuse an existing type wildcard export to export all values',
            code: 'export type * from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export * from "croct";',
        },
        {
            description: 'reuse an existing value wildcard export to export a named value',
            code: 'export * from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            modified: false,
            result: 'export * from "croct";',
        },
        {
            description: 'reuse an existing type wildcard export to export a named type',
            code: 'export type * from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            modified: false,
            result: 'export type * from "croct";',
        },
        {
            description: 'ignore an existing value wildcard export to export an aliased value',
            code: 'export * from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: true,
            result: 'export * from "croct";\nexport { sdk as alias } from "croct";',
        },
        {
            description: 'ignore an existing type wildcard export to export an aliased type',
            code: 'export type * from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: true,
            result: 'export type * from "croct";\nexport type { sdk as alias } from "croct";',
        },
        {
            description: 'ignore an existing wildcard type export to export a value',
            code: 'export type * from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            modified: true,
            result: 'export type * from "croct";\nexport { sdk } from "croct";',
        },
        {
            description: 'ignore an existing wildcard type export to export an aliased value',
            code: 'export type * from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: true,
            result: 'export type * from "croct";\nexport { sdk as alias } from "croct";',
        },
        {
            description: 'reuse an existing value wildcard export to export a named type',
            code: 'export * from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            modified: false,
            result: 'export * from "croct";',
        },
        {
            description: 'ignore an existing value wildcard export to export an aliased type',
            code: 'export * from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: true,
            result: 'export * from "croct";\nexport type { sdk as alias } from "croct";',
        },
        {
            description: 'ignore an existing value wildcard export to export an aliased type',
            code: 'export * from "croct";',
            declaration: {
                moduleName: 'croct',
                type: 'type',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: true,
            result: 'export * from "croct";\nexport type { sdk as alias } from "croct";',
        },
        {
            description: 'reuse an existing named value export',
            code: 'export { sdk } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'sdk',
            },
            modified: false,
            result: 'export { sdk } from "croct";',
        },
        {
            description: 'reuse a named value export to export a named type',
            code: 'export {sdk, type other} from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
            },
            modified: false,
            result: 'export { sdk, type other } from "croct";',
        },
        {
            description: 'reuse a named type export to export a value',
            code: 'export type {sdk} from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
            },
            modified: true,
            result: 'export { sdk } from "croct";',
        },
        {
            description: 'reuse an existing named type export',
            code: 'export type { sdk } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'sdk',
            },
            modified: false,
            result: 'export type { sdk } from "croct";',
        },
        {
            description: 'reuse an existing aliased value export',
            code: 'export { sdk as alias } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: false,
            result: 'export { sdk as alias } from "croct";',
        },
        {
            description: 'reuse an existing aliased type export',
            code: 'export type { sdk as alias } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'sdk',
                exportName: 'alias',
            },
            modified: false,
            result: 'export type { sdk as alias } from "croct";',
        },
        {
            description: 'add a named value export to an existing named export',
            code: 'export { sdk } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'other',
            },
            modified: true,
            result: 'export { sdk, other } from "croct";',
        },
        {
            description: 'add a named type export to an existing named export',
            code: 'export type { sdk } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'other',
            },
            modified: true,
            result: 'export type { sdk, other } from "croct";',
        },
        {
            description: 'add an aliased value export to an existing named export',
            code: 'export { sdk } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'other',
                exportName: 'alias',
            },
            modified: true,
            result: 'export { sdk, other as alias } from "croct";',
        },
        {
            description: 'add an aliased type export to an existing named export',
            code: 'export type { sdk } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'other',
                exportName: 'alias',
            },
            modified: true,
            result: 'export type { sdk, other as alias } from "croct";',
        },
        {
            description: 'add a named value export to an existing type export',
            code: 'export type { sdk } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'other',
            },
            modified: true,
            result: 'export { type sdk, other } from "croct";',
        },
        {
            description: 'add a named type export to an existing value export',
            code: 'export { sdk } from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
                importName: 'other',
            },
            modified: true,
            result: 'export { sdk, type other } from "croct";',
        },
        {
            description: 'replace all named exports with a wildcard export',
            code: 'export { sdk } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export * from "croct";',
        },
        {
            description: 'keep aliased exports adding a wildcard export',
            code: 'export { sdk as alias } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export { sdk as alias } from "croct";\nexport * from "croct";',
        },
        {
            description: 'keep namespaced exports adding a wildcard export',
            code: 'export * as sdk from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export * as sdk from "croct";\nexport * from "croct";',
        },
        {
            description: 'replace type exports with a wildcard export',
            code: 'export {type sdk} from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export * from "croct";',
        },
        {
            description: 'replace type and value exports with a wildcard export',
            code: 'export {content, type sdk} from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export * from "croct";',
        },
        {
            description: 'remove type exports adding a type wildcard export',
            code: 'export {content, type sdk} from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export { content } from "croct";\nexport type * from "croct";',
        },
        {
            description: 'keep aliased exports adding a type wildcard export',
            code: 'export {content as contentAlias, type sdk as sdkType} from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export { content as contentAlias, type sdk as sdkType } from "croct";\n'
                + 'export type * from "croct";',
        },
        {
            description: 'keep aliased exports adding a value wildcard export',
            code: 'export {content as contentAlias, type sdk as sdkType} from "croct";',
            declaration: {
                type: 'type',
                moduleName: 'croct',
            },
            modified: true,
            result: 'export { content as contentAlias, type sdk as sdkType } from "croct";\n'
                + 'export type * from "croct";',
        },
        {
            description: 'ignore named exports from other modules',
            code: 'export { sdk } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'other',
                importName: 'sdk',
            },
            modified: true,
            result: 'export { sdk } from "croct";\nexport { sdk } from "other";',
        },
        {
            description: 'ignore export all from other modules',
            code: 'export * from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'other',
            },
            modified: true,
            result: 'export * from "croct";\nexport * from "other";',
        },
        {
            description: 'modify the most specific export',
            code: 'export { somethingElse } from "croct";\nexport type { something } from "croct";',
            declaration: {
                type: 'value',
                moduleName: 'croct',
                importName: 'something',
            },
            modified: true,
            result: 'export { somethingElse } from "croct";\nexport { something } from "croct";',
        },
    ])('should $description', ({code, declaration, modified, result}) => {
        const ast = parse(code, ['typescript']);
        const parsedAst = cloneNode(ast, true);
        const modifiedAst = cloneNode(parsedAst, true);

        resetExportKind(modifiedAst);

        const parsedResult = addReexport(parsedAst, declaration);

        expect(generate(parsedAst).code).toEqual(result);
        expect(parsedResult).toEqual(modified);

        const modifiedResult = addReexport(modifiedAst, declaration);

        expect(generate(modifiedAst).code).toEqual(result);
        expect(modifiedResult).toEqual(modified);

        expect(isNodesEquivalent(ast, parsedAst)).toBe(!modified);
    });

    function resetExportKind(file: File): void {
        traverse(file, {
            ExportSpecifier: function accept(path) {
                if (path.node.exportKind === 'value') {
                    // eslint-disable-next-line no-param-reassign -- In place mutation is required
                    path.node.exportKind = null;
                }
            },
            ExportDeclaration: function accept(path) {
                if (path.node.exportKind === 'value') {
                    // eslint-disable-next-line no-param-reassign -- In place mutation is required
                    path.node.exportKind = null;
                }
            },
        });
    }
});
