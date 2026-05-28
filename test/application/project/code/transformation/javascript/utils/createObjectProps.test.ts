import * as t from '@babel/types';
import {generate} from '@babel/generator';
import type {AttributeType} from '@/application/project/code/transformation/javascript/utils/createObjectProps';
import {
    buildPropertyExpression,
    createPropsObject,
} from '@/application/project/code/transformation/javascript/utils/createObjectProps';

describe('createObjectProps', () => {
    function print(node: t.Node): string {
        return generate(node, {concise: true}).code;
    }

    describe('buildPropertyExpression', () => {
        it('should build a single-segment identifier reference', () => {
            const expression = buildPropertyExpression({
                type: 'reference',
                path: ['foo'],
            });

            expect(t.isIdentifier(expression)).toBe(true);
            expect(print(expression)).toBe('foo');
        });

        it('should build a two-segment member reference', () => {
            const expression = buildPropertyExpression({
                type: 'reference',
                path: ['foo', 'bar'],
            });

            expect(print(expression)).toBe('foo.bar');
        });

        it('should build a deep member reference', () => {
            const expression = buildPropertyExpression({
                type: 'reference',
                path: ['process', 'env', 'NODE_ENV'],
            });

            expect(print(expression)).toBe('process.env.NODE_ENV');
        });

        it('should build a string literal', () => {
            const expression = buildPropertyExpression({
                type: 'literal',
                value: 'hello',
            });

            expect(print(expression)).toBe('"hello"');
        });

        it('should build a number literal', () => {
            const expression = buildPropertyExpression({
                type: 'literal',
                value: 42,
            });

            expect(print(expression)).toBe('42');
        });

        it('should build a boolean literal', () => {
            const expression = buildPropertyExpression({
                type: 'literal',
                value: true,
            });

            expect(print(expression)).toBe('true');
        });

        it('should build a null literal', () => {
            const expression = buildPropertyExpression({
                type: 'literal',
                value: null,
            });

            expect(print(expression)).toBe('null');
        });

        it('should build a comparison expression', () => {
            const expression = buildPropertyExpression({
                type: 'comparison',
                operator: '===',
                left: {type: 'reference', path: ['process', 'env', 'NODE_ENV']},
                right: {type: 'literal', value: 'production'},
            });

            expect(print(expression)).toBe('process.env.NODE_ENV === "production"');
        });

        it('should build a comparison expression with other operators', () => {
            const operators: Array<AttributeType['type'] extends never ? never : '===' | '!==' | '>' | '>=' | '<' | '<='> = [
                '===',
                '!==',
                '>',
                '>=',
                '<',
                '<=',
            ];

            for (const operator of operators) {
                const expression = buildPropertyExpression({
                    type: 'comparison',
                    operator: operator,
                    left: {type: 'literal', value: 1},
                    right: {type: 'literal', value: 2},
                });

                expect(print(expression)).toBe(`1 ${operator} 2`);
            }
        });

        it('should build a ternary expression', () => {
            const expression = buildPropertyExpression({
                type: 'ternary',
                condition: {
                    operator: '===',
                    left: {type: 'reference', path: ['process', 'env', 'NODE_ENV']},
                    right: {type: 'literal', value: 'production'},
                },
                consequent: {type: 'literal', value: 'prod'},
                alternate: {type: 'literal', value: 'dev'},
            });

            expect(print(expression)).toBe('process.env.NODE_ENV === "production" ? "prod" : "dev"');
        });
    });

    describe('createPropsObject', () => {
        it('should build an empty object expression from no attributes', () => {
            const expression = createPropsObject({});

            expect(t.isObjectExpression(expression)).toBe(true);
            expect(expression.properties).toHaveLength(0);
        });

        it('should build an object expression with a single property', () => {
            const expression = createPropsObject({
                appId: {type: 'literal', value: 'abc'},
            });

            expect(print(expression)).toBe('{ appId: "abc" }');
        });

        it('should build an object expression with multiple properties', () => {
            const expression = createPropsObject({
                appId: {type: 'literal', value: 'abc'},
                debug: {type: 'literal', value: true},
                count: {type: 'literal', value: 7},
            });

            expect(print(expression)).toBe('{ appId: "abc", debug: true, count: 7 }');
        });

        it('should build an object expression mixing all attribute types', () => {
            const expression = createPropsObject({
                literal: {type: 'literal', value: 'l'},
                reference: {type: 'reference', path: ['process', 'env', 'X']},
                ternary: {
                    type: 'ternary',
                    condition: {
                        operator: '===',
                        left: {type: 'reference', path: ['mode']},
                        right: {type: 'literal', value: 'prod'},
                    },
                    consequent: {type: 'literal', value: 'a'},
                    alternate: {type: 'literal', value: 'b'},
                },
                comparison: {
                    type: 'comparison',
                    operator: '>',
                    left: {type: 'literal', value: 1},
                    right: {type: 'literal', value: 0},
                },
            });

            expect(print(expression))
                .toBe('{ literal: "l", reference: process.env.X, ternary: mode === "prod" ? "a" : "b", comparison: 1 > 0 }');
        });
    });
});
