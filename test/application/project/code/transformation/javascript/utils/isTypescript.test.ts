import {isTypescript} from '@/application/project/code/transformation/javascript/utils/isTypescript';

describe('isTypescript', () => {
    type Scenario = {
        description: string,
        code: string,
        expected: boolean,
    };

    it.each<Scenario>([
        {
            description: 'match detect type import',
            code: 'import type {Foo} from \'@croct/sdk\';',
            expected: true,
        },
        {
            description: 'match detect import type specifier',
            code: 'import {type Foo} from \'@croct/sdk\';',
            expected: true,
        },
        {
            description: 'match detect types',
            code: 'type Foo = {foo: string};',
            expected: true,
        },
        {
            description: 'match detect interface',
            code: 'interface Foo {foo: string};',
            expected: true,
        },
        {
            description: 'match generic type',
            code: 'class Foo<T> {foo: T};',
            expected: true,
        },
        {
            description: 'match type cast',
            code: 'const foo = {} as Foo;',
            expected: true,
        },
        {
            description: 'match non-null assertion',
            code: 'const foo = {}!;',
            expected: true,
        },
        {
            description: 'match type assertion',
            code: 'const foo = (foo: any): foo is Foo => true;',
            expected: true,
        },
    ])('should $description', ({code, expected}) => {
        expect(isTypescript(code)).toBe(expected);
    });
});
