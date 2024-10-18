import {resolve} from 'path';
import {MiddlewareOptions, RefactorMiddleware} from '@/application/project/sdk/code/nextjs/refactorMiddleware';
import {assertTransformed, loadFixtures} from '../fixtures';
import {TransformParsedCode} from '@/application/project/sdk/code/transformParsedCode';

describe('RefactorMiddleware', () => {
    const defaultOptions: MiddlewareOptions = {
        import: {
            module: '@croct/plug-next/middleware',
            functionName: 'withCroct',
            matcherName: 'matcher',
            matcherLocalName: 'matcher',
        },
    };

    const scenarios = loadFixtures<MiddlewareOptions>(
        resolve(__dirname, '../fixtures/middleware'),
        defaultOptions,
        {
            'matcherAlias.ts': {
                import: {
                    ...defaultOptions.import,
                    matcherLocalName: 'croctMatcher',
                },
            },
        },
    );

    // eslint-disable-next-line jest/expect-expect -- expect is called in the assertTransformed function
    it.each(scenarios)('should correctly transform $name', ({fixture, options}) => {
        assertTransformed(fixture, new TransformParsedCode(new RefactorMiddleware(options)));
    });
});
