import {ExportMatcher, hasReexport} from '@/application/project/sdk/code/javascript/hasReexport';

describe('hasReexport', () => {
    type Scenario = {
        description: string,
        code: string,
        matcher: ExportMatcher,
        expected: boolean,
    };

    it.each<Scenario>([
        {
            description: 'match the re-exported module name exactly',
            code: 'export {sdk} from \'croct\';',
            matcher: {
                moduleName: 'croct',
            },
            expected: true,
        },
        {
            description: 'match the re-exported module name with a regular expression',
            code: 'export {sdk} from \'croct\';',
            matcher: {
                moduleName: /croct/,
            },
            expected: true,
        },
        {
            description: 'not match the re-exported module name',
            code: 'export {sdk} from \'croct\';',
            matcher: {
                moduleName: 'croct-sdk',
            },
            expected: false,
        },
        {
            description: 'not match the re-exported import name',
            code: 'export {sdk} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'croct-sdk',
            },
            expected: false,
        },
        {
            description: 'match the re-exported aliased import name exactly',
            code: 'export {sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'sdk',
            },
            expected: true,
        },
        {
            description: 'not match the re-exported aliased import name',
            code: 'export {sdk as croct} from \'croct\';',
            matcher: {
                moduleName: 'croct',
                importName: 'croct-sdk',
            },
            expected: false,
        },
    ])('should $description', ({code, matcher, expected}) => {
        expect(hasReexport(code, matcher)).toBe(expected);
    });
});
