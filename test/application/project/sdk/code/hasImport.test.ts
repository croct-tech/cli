import {hasImport, ImportMatcher} from '@/application/project/sdk/code/hasImport';

describe('hasImport', () => {
    type Scenario = {
        description: string,
        code: string,
        matcher: ImportMatcher,
        expected: boolean,
    };

    it.each<Scenario>([
        {
            description: 'not match invalid code',
            code: 'import croct',
            matcher: {
                moduleName: 'croct',
            },
            expected: false,
        },
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
            description: 'match the aliased import name exactly',
            code: 'import {foo, sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: true,
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
    ])('should $description', ({code, matcher, expected}) => {
        expect(hasImport(code, matcher)).toBe(expected);
    });
});
