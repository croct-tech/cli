import {hasImport, ImportMatcher} from '@/application/project/code/codemod/javascript/hasImport';

describe('hasImport', () => {
    type Scenario = {
        description: string,
        code: string,
        matcher: ImportMatcher,
        expected: boolean,
    };

    it.each<Scenario>([
        {
            description: 'match the module name exactly',
            code: 'import croct from \'croct\'; <foo/>', // tsx
            matcher: {
                moduleName: 'croct',
            },
            expected: true,
        },
        {
            description: 'match the module name with a regular expression',
            code: 'import croct from \'@croct/\';',
            matcher: {
                moduleName: /@croct/,
            },
            expected: true,
        },
        {
            description: 'match the import name exactly',
            code: 'import {sdk} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: true,
        },
        {
            description: 'match the import name with a regular expression',
            code: 'import {sdk} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: /sdk/,
            },
            expected: true,
        },
        {
            description: 'match the aliased import name exactly',
            code: 'import {foo, sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: true,
        },
        {
            description: 'match the import name and local name exactly',
            code: 'import {sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
                localName: 'croct',
            },
            expected: true,
        },
        {
            description: 'match a string local name',
            code: 'import {"sdk" as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                localName: 'croct',
            },
            expected: true,
        },
        {
            description: 'match the local name only',
            code: 'import {sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                localName: 'croct',
            },
            expected: true,
        },
        {
            description: 'match the local name with a regular expression',
            code: 'import {sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                localName: /croct/,
            },
            expected: true,
        },
        {
            description: 'not match the module name',
            code: 'import croct from \'croct\';',
            matcher: {
                moduleName: 'croct-sdk',
            },
            expected: false,
        },
        {
            description: 'not match the import name',
            code: 'import {croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'croct-sdk',
            },
            expected: false,
        },
        {
            description: 'not match the aliased import name',
            code: 'import {foo, sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'croct-sdk',
            },
            expected: false,
        },
        {
            description: 'not match the local name',
            code: 'import {sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                localName: 'croct-sdk',
            },
            expected: false,
        },
        {
            description: 'not match the import name and local name',
            code: 'import {sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
                localName: 'wrong',
            },
            expected: false,
        },
    ])('should $description', ({code, matcher, expected}) => {
        expect(hasImport(code, matcher)).toBe(expected);
    });
});
