import {getExportedNames} from '@/application/project/code/transformation/javascript/utils/getExportedNames';

describe('getExportedNames', () => {
    type Scenario = {
        description: string,
        code: string,
        names: string[],
    };

    it.each<Scenario>([
        {
            description: 'detect const export',
            code: 'export const foo = 1',
            names: ['foo'],
        },
        {
            description: 'detect function export',
            code: 'export function foo() {}',
            names: ['foo'],
        },
        {
            description: 'detect class export',
            code: 'export class Foo {}',
            names: ['Foo'],
        },
        {
            description: 'detect multiple exports',
            code: 'export const foo = 1; export function bar() {}',
            names: ['foo', 'bar'],
        },
        {
            description: 'detect named export with alias',
            code: 'const foo = 1; export {foo as bar}',
            names: ['bar'],
        },
        {
            description: 'detect multiple named exports',
            code: 'const foo = 1; const bar = 2; export {foo, bar}',
            names: ['foo', 'bar'],
        },
        {
            description: 'detect named export from another module',
            code: 'export {foo} from "bar"',
            names: ['foo'],
        },
        {
            description: 'detect named export from another module with alias',
            code: 'export {foo as bar} from "baz"',
            names: ['bar'],
        },
        {
            description: 'detect multiple named exports from another module',
            code: 'export {foo, bar} from "baz"',
            names: ['foo', 'bar'],
        },
        {
            description: 'detect mixed exports',
            code: 'export const foo = 1; export {bar as baz} from "qux"',
            names: ['foo', 'baz'],
        },
        {
            description: 'detect namespace export with alias',
            code: 'export * as foo from "bar"',
            names: ['foo'],
        },
        {
            description: 'detect default export from another module with alias',
            code: 'export {default as foo} from "bar"',
            names: ['foo'],
        },
        {
            description: 'not detect default export',
            code: 'export default 1',
            names: [],
        },
        {
            description: 'not detect namespace export',
            code: 'export * from "foo"',
            names: [],
        },
        {
            description: 'not detect default function export',
            code: 'export default function foo() {}',
            names: [],
        },
        {
            description: 'not detect default class export',
            code: 'export default class Foo {}',
            names: [],
        },
        {
            description: 'not detect default export from another module',
            code: 'export {default} from "foo"',
            names: [],
        },
    ])('should $description', ({code, names}) => {
        expect(getExportedNames(code)).toStrictEqual(names);
    });
});
