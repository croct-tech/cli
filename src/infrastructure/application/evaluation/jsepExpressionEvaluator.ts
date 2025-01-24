import {JsonObject, JsonValue} from '@croct/json';
import jsep, {CoreExpression, Expression} from 'jsep';
import jsepObject, {ObjectExpression} from '@jsep-plugin/object';
import {
    EvaluationContext,
    EvaluationError,
    ExpressionEvaluator,
    VariableMap,
    VariableValue,
} from '@/application/template/evaluation';

type LazyOperand = () => Promise<JsonValue>;

type UnaryOperator = {
    evaluate: (operand: LazyOperand) => Promise<JsonValue>,
};

type BinaryOperator = {
    precedence: number,
    evaluate: (left: LazyOperand, right: LazyOperand) => Promise<JsonValue>,
};

type ExtendedExpression = Expression|CoreExpression|ObjectExpression;

type JsepExpression<T extends ExtendedExpression['type']> = {
    [K in T]: Extract<ExtendedExpression, {type: K}>;
}[T];

export class JsepExpressionEvaluator implements ExpressionEvaluator {
    private static readonly LITERALS: Record<string, JsonValue> = {
        true: true,
        false: false,
        null: null,
    };

    private static readonly UNARY_OPERATORS: Record<string, UnaryOperator> = {
        '!': {
            evaluate: async operand => !await expectBoolean(operand),
        },
        '-': {
            evaluate: async operand => -await expectNumber(operand),
        },
        '+': {
            evaluate: async operand => +await expectNumber(operand),
        },
    };

    private static readonly BINARY_OPERATORS: Record<string, BinaryOperator> = {
        '||': {
            precedence: 1,
            evaluate: async (left, right) => (await expectBoolean(left)) || expectBoolean(right),
        },
        '??': {
            precedence: 1,
            evaluate: async (left, right) => (await left()) ?? right(),
        },
        '&&': {
            precedence: 2,
            evaluate: async (left, right) => (await expectBoolean(left)) && expectBoolean(right),
        },
        '==': {
            precedence: 6,
            // eslint-disable-next-line eqeqeq -- Intentional loose comparison
            evaluate: async (left, right) => (await left()) == (await right()),
        },
        '===': {
            precedence: 6,
            evaluate: async (left, right) => (await left()) === (await right()),
        },
        '!=': {
            precedence: 6,
            // eslint-disable-next-line eqeqeq -- Intentional loose comparison
            evaluate: async (left, right) => (await left()) != (await right()),
        },
        '!==': {
            precedence: 6,
            evaluate: async (left, right) => (await left()) !== (await right()),
        },
        '<': {
            precedence: 7,
            evaluate: async (left, right) => (await expectNumber(left)) < (await expectNumber(right)),
        },
        '>': {
            precedence: 7,
            evaluate: async (left, right) => (await expectNumber(left)) > (await expectNumber(right)),
        },
        '<=': {
            precedence: 7,
            evaluate: async (left, right) => (await expectNumber(left)) <= (await expectNumber(right)),
        },
        '>=': {
            precedence: 7,
            evaluate: async (left, right) => (await expectNumber(left)) >= (await expectNumber(right)),
        },
        '+': {
            precedence: 9,
            evaluate: async (left, right) => (await expectNumber(left)) + (await expectNumber(right)),
        },
        '-': {
            precedence: 9,
            evaluate: async (left, right) => (await expectNumber(left)) - (await expectNumber(right)),
        },
        '*': {
            precedence: 10,
            evaluate: async (left, right) => (await expectNumber(left)) * (await expectNumber(right)),
        },
        '/': {
            precedence: 10,
            evaluate: async (left, right) => (await expectNumber(left)) / (await expectNumber(right)),
        },
        '%': {
            precedence: 10,
            evaluate: async (left, right) => (await expectNumber(left)) % (await expectNumber(right)),
        },
        '**': {
            precedence: 11,
            evaluate: async (left, right) => (await expectNumber(left)) ** (await expectNumber(right)),
        },
    };

    private readonly parserCache: Map<string, Expression> = new Map();

    private readonly resolutionCache: WeakMap<any, JsonValue> = new WeakMap();

    public evaluate(expression: string, variables?: VariableMap): Promise<JsonValue> {
        return this.evaluateExpression(this.parse(expression), variables);
    }

    private parse(expression: string): Expression {
        const cachedExpression = this.parserCache.get(expression);

        if (cachedExpression !== undefined) {
            return cachedExpression;
        }

        jsep.plugins.register(jsepObject);

        jsep.removeAllUnaryOps();

        for (const operator of Object.keys(JsepExpressionEvaluator.UNARY_OPERATORS)) {
            jsep.addUnaryOp(operator);
        }

        jsep.removeAllBinaryOps();

        for (const [operator, {precedence}] of Object.entries(JsepExpressionEvaluator.BINARY_OPERATORS)) {
            jsep.addBinaryOp(operator, precedence);
        }

        jsep.removeAllLiterals();

        for (const [literal, value] of Object.entries(JsepExpressionEvaluator.LITERALS)) {
            jsep.addLiteral(literal, value);
        }

        let parsedExpression: Expression;

        try {
            parsedExpression = jsep(expression);
        } catch (error) {
            throw new EvaluationError('Malformed expression.', {
                cause: error,
                details: [
                    `Expression: ${expression}`,
                ],
            });
        }

        this.parserCache.set(expression, parsedExpression);

        return parsedExpression;
    }

    private async evaluateExpression(expression: Expression, context?: EvaluationContext): Promise<JsonValue> {
        switch (true) {
            case matches(expression, 'Literal'):
                return expression.value as JsonValue;

            case matches(expression, 'ThisExpression'):
            case matches(expression, 'Identifier'): {
                const name = expression.type === 'ThisExpression' ? 'this' : expression.name;

                const value = context?.variables?.[name];

                if (value === undefined) {
                    throw new EvaluationError(`Unknown variable \`${name}\`.`);
                }

                return this.resolve(value);
            }

            case matches(expression, 'ArrayExpression'):
                return Promise.all(
                    expression.elements.flatMap(
                        element => (element === null ? [] : [this.evaluateExpression(element, context)]),
                    ),
                );

            case matches(expression, 'ObjectExpression'):
                return Object.fromEntries(
                    await Promise.all(
                        expression.properties.map(
                            async ({key, value}) => {
                                if (value === undefined && matches(key, 'Identifier')) {
                                    return [key.name, await this.evaluateExpression(key, context)];
                                }

                                const name = matches(key, 'Identifier')
                                    ? key.name
                                    : this.evaluateExpression(key, context)
                                        .then(result => {
                                            if (typeof result !== 'string' && typeof result !== 'number') {
                                                throw new EvaluationError(
                                                    `Property must be a string or a number, got ${typeof result}.`,
                                                );
                                            }

                                            return result;
                                        });

                                return [name, await this.evaluateExpression(value!, context)];
                            },
                        ),
                    ),
                );

            case matches(expression, 'UnaryExpression'):
                return JsepExpressionEvaluator.UNARY_OPERATORS[expression.operator].evaluate(
                    () => this.evaluateExpression(expression.argument, context),
                );

            case matches(expression, 'BinaryExpression'):
                return JsepExpressionEvaluator.BINARY_OPERATORS[expression.operator].evaluate(
                    () => this.evaluateExpression(expression.left, context),
                    () => this.evaluateExpression(expression.right, context),
                );

            case matches(expression, 'MemberExpression'): {
                const object = await this.evaluateExpression(expression.object, context);

                if (typeof object !== 'object' || object === null) {
                    throw new EvaluationError('Object expected.');
                }

                const property = expression.computed
                    ? await this.evaluateExpression(expression.property, context)
                    : expression.property.name;

                if (typeof property !== 'string' && typeof property !== 'number') {
                    throw new EvaluationError(`Property must be a string or a number, got ${typeof property}.`);
                }

                if (Array.isArray(object)) {
                    if (typeof property === 'string') {
                        if (!['length'].includes(property)) {
                            throw new EvaluationError(`Array property \`${property}\` is not defined.`);
                        }

                        return object.length;
                    }

                    if (property < 0 || property >= object.length) {
                        throw new EvaluationError(`Array index ${property} is out of bounds.`);
                    }

                    return object[property];
                }

                if (object[property] === undefined || !Object.hasOwn(object, property)) {
                    throw new EvaluationError(`Property \`${property}\` is not defined.`);
                }

                return object[property];
            }

            case matches(expression, 'CallExpression'): {
                if (!matches(expression.callee, 'Identifier')) {
                    throw new EvaluationError('Callee is not a function.');
                }

                const {name} = expression.callee;

                const fn = context?.functions?.[expression.callee.name];

                if (fn === undefined) {
                    throw new EvaluationError(`Unknown function \`${name}\`.`);
                }

                return fn(
                    ...await Promise.all(
                        expression.arguments.map(argument => this.evaluateExpression(argument, context)),
                    ),
                );
            }

            case matches(expression, 'ConditionalExpression'):
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- Intentional type juggling
                return await this.evaluateExpression(expression.test, context)
                    ? this.evaluateExpression(expression.consequent, context)
                    : this.evaluateExpression(expression.alternate, context);

            default:
                throw new EvaluationError(`Unsupported expression type \`${expression.type}\`.`);
        }
    }

    private async resolve(value: VariableValue): Promise<JsonValue> {
        const cachedValue = this.resolutionCache.get(value);

        if (cachedValue !== undefined) {
            return cachedValue;
        }

        if (typeof value === 'function') {
            const resolvedValue = await value();

            this.resolutionCache.set(value, resolvedValue);

            return resolvedValue;
        }

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const record: JsonObject = {};
            let resolved = false;

            for (const [key, propertyValue] of Object.entries(value)) {
                if (propertyValue === undefined) {
                    continue;
                }

                record[key] = await this.resolve(propertyValue);

                resolved = resolved || record[key] !== propertyValue;
            }

            if (Object.isFrozen(value)) {
                Object.freeze(record);
            } else if (Object.isSealed(value)) {
                Object.seal(record);
            }

            if (resolved) {
                this.resolutionCache.set(value, record);

                return record;
            }

            return value as JsonValue;
        }

        return value;
    }
}

function matches<T extends ExtendedExpression['type']>(
    expression: ExtendedExpression,
    type: T,
): expression is JsepExpression<T> {
    return expression.type === type;
}

async function expectNumber(operand: LazyOperand): Promise<number> {
    const value = await operand();

    if (typeof value !== 'number') {
        throw new EvaluationError(`Number expected, got ${typeof value}.`);
    }

    return value;
}

async function expectBoolean(operand: LazyOperand): Promise<boolean> {
    const value = await operand();

    if (typeof value !== 'boolean') {
        throw new EvaluationError(`Boolean expected, got ${typeof value}.`);
    }

    return value;
}
