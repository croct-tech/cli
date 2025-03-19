import {
    getImportLocalName,
    ImportMatcher,
} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';

describe('getImportLocalName', () => {
    type Scenario = {
        description: string,
        code: string,
        matcher: ImportMatcher,
        expected: string|null,
    };

    it.each<Scenario>([
        {
            description: 'return null if no import is found',
            code: '<tsx/>',
            matcher: {
                moduleName: 'croct',
                importName: 'default',
            },
            expected: null,
        },
        {
            description: 'return null if the import does not match the module name',
            code: 'import sdk from \'croct\';',
            matcher: {
                moduleName: 'something',
                importName: 'default',
            },
            expected: null,
        },
        {
            description: 'return null if the import does not match the import name',
            code: 'import sdk from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'something',
            },
            expected: null,
        },
        {
            description: 'return the local name of the default import',
            code: 'import sdk from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'default',
            },
            expected: 'sdk',
        },
        {
            description: 'return the local name of the default import when it is aliased',
            code: 'import {default as sdk} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'default',
            },
            expected: 'sdk',
        },
        {
            description: 'return the local name of the named import',
            code: 'import {sdk} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: 'sdk',
        },
        {
            description: 'return the local name of a literal named import',
            code: 'import {"sdk" as alias} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: 'alias',
        },
        {
            description: 'return the local name of the named import when it is aliased',
            code: 'import {sdk as alias} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: 'alias',
        },
        {
            description: 'return the local name of the named import when the import matches the regex',
            code: 'import {sdk as alias} from \'croct\';',
            matcher: {
                moduleName: /croct/,
                importName: /sdk/,
            },
            expected: 'alias',
        },
    ])('should $description', ({code, matcher, expected}) => {
        expect(getImportLocalName(code, matcher)).toBe(expected);
    });
});
