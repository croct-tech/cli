import {JsonValue} from '@croct/json';
import jsep, {CoreExpression, Expression} from 'jsep';
import jsepObject, {Property} from '@jsep-plugin/object';
import jsepSpread, {SpreadElement} from '@jsep-plugin/spread';
import {
    EvaluationContext,
    EvaluationError,
    ExpressionEvaluator,
    GenericFunction,
    VariableMap,
} from '@/application/template/evaluation';
import {Deferred, Deferrable} from '@/application/template/deferral';
import {Help, HelpfulError} from '@/application/error';

export type Configuration = {
    functions?: Record<string, GenericFunction>,
};

type LazyOperand = () => Deferred<JsonValue>;

type UnaryOperator = {
    evaluate: (operand: LazyOperand) => Deferred<JsonValue>,
};

type BinaryOperator = {
    precedence: number,
    evaluate: (left: LazyOperand, right: LazyOperand) => Deferred<JsonValue>,
};

interface ExtendedObjectExpression extends Expression {
    type: 'ObjectExpression';
    properties: Array<Property|SpreadElement>;
}

type ExtendedExpression = Expression|CoreExpression|SpreadElement|ExtendedObjectExpression;

type JsepExpression<T extends ExtendedExpression['type']> = {
    [K in T]: Extract<ExtendedExpression, {type: K}>;
}[T];

type Methods<T> = Exclude<
    keyof {[K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K]},
    Exclude<PropertyKey, string>
>;

type Properties<T> = Exclude<
    keyof {[K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K]},
    Exclude<PropertyKey, string>
>;

type MethodOwner<T, P extends string> = T & Record<P, GenericFunction>;
type PropertyOwner<T, P extends string> = T & Record<P, Deferrable<JsonValue>>;

class UndefinedValueError extends EvaluationError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, UndefinedValueError.prototype);
    }
}

export class JsepExpressionEvaluator implements ExpressionEvaluator {
    private static readonly ALLOWED_ARRAY_PROPERTIES: Array<Properties<any[]>> = [
        'length',
    ];

    private static readonly ALLOWED_ARRAY_METHODS: Array<Methods<any[]>> = [
        'slice',
        'join',
    ];

    // eslint-disable-next-line @typescript-eslint/ban-types -- Intentional use of String for correct type inference
    private static readonly ALLOWED_STRING_PROPERTIES: Array<Properties<String>> = [
        'length',
    ];

    // eslint-disable-next-line @typescript-eslint/ban-types -- Intentional use of String for correct type inference
    private static readonly ALLOWED_STRING_METHODS: Array<Methods<String>> = [
        'slice',
        'includes',
        'startsWith',
        'endsWith',
        'toLowerCase',
        'toUpperCase',
    ];

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
            evaluate: async (left, right) => {
                let value: Deferrable<JsonValue> = null;

                try {
                    value = await left();
                } catch (error) {
                    if (!(error instanceof UndefinedValueError)) {
                        throw error;
                    }
                }

                return value ?? right();
            },
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
            evaluate: async (left, right) => {
                const [leftValue, rightValue] = await Promise.all([left(), right()]);

                if (typeof leftValue === 'string' || typeof rightValue === 'string') {
                    return `${leftValue}${rightValue}`;
                }

                if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
                    throw new EvaluationError(
                        'Operands must be numbers or strings, '
                        + `got ${HelpfulError.describeType(leftValue)} and ${HelpfulError.describeType(rightValue)}.`,
                    );
                }

                return leftValue + rightValue;
            },
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

    private readonly configuration: Configuration;

    private readonly cache: Map<string, Expression> = new Map();

    public constructor(configuration: Configuration = {}) {
        this.configuration = configuration;
    }

    public evaluate(expression: string, variables?: VariableMap): Deferred<JsonValue> {
        return this.evaluateExpression(this.parse(expression), variables);
    }

    private parse(expression: string): Expression {
        const cachedExpression = this.cache.get(expression);

        if (cachedExpression !== undefined) {
            return cachedExpression;
        }

        jsep.plugins.register(jsepObject);
        jsep.plugins.register(jsepSpread);

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

        this.cache.set(expression, parsedExpression);

        return parsedExpression;
    }

    private async evaluateExpression(expression: Expression, context?: EvaluationContext): Deferred<JsonValue> {
        switch (true) {
            case matches(expression, 'Literal'):
                return expression.value as JsonValue;

            case matches(expression, 'ThisExpression'):
            case matches(expression, 'Identifier'): {
                const name = expression.type === 'ThisExpression' ? 'this' : expression.name;

                const value = context?.variables?.[name];

                if (value === undefined) {
                    throw new EvaluationError(`Variable \`${name}\` is unknown.`);
                }

                return value;
            }

            case matches(expression, 'ArrayExpression'): {
                const elements = await Promise.all(
                    expression.elements.map(async element => {
                        if (element === null) {
                            return [];
                        }

                        if (matches(element, 'SpreadElement')) {
                            const value = await this.evaluateExpression(element.argument, context);

                            if (!Array.isArray(value)) {
                                throw new EvaluationError(
                                    'Spread expression must evaluate to an array, '
                                    + `got ${HelpfulError.describeType(value)}.`,
                                );
                            }

                            return value;
                        }

                        return [await this.evaluateExpression(element, context)];
                    }),
                );

                return elements.flat();
            }

            case matches(expression, 'ObjectExpression'): {
                const entries = await Promise.all(
                    expression.properties.map(
                        async property => {
                            if (matches(property, 'SpreadElement')) {
                                const value = await this.evaluateExpression(property.argument, context);

                                if (typeof value !== 'object' || value === null) {
                                    throw new EvaluationError(
                                        'Spread expression must evaluate to an object, '
                                        + `got ${HelpfulError.describeType(value)}.`,
                                    );
                                }

                                return Object.entries(value);
                            }

                            if (property.value === undefined && matches(property.key, 'Identifier')) {
                                return [[property.key.name, await this.evaluateExpression(property.key, context)]];
                            }

                            const name = matches(property.key, 'Identifier')
                                ? property.key.name
                                : await this.evaluateExpression(property.key, context)
                                    .then(result => {
                                        if (typeof result !== 'string' && typeof result !== 'number') {
                                            throw new EvaluationError(
                                                'Property name must be a string or a number, '
                                                + `got ${HelpfulError.describeType(result)}.`,
                                            );
                                        }

                                        return result;
                                    });

                            return [[name, await this.evaluateExpression(property.value!, context)]];
                        },
                    ),
                );

                return Object.fromEntries(entries.flat());
            }

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
                    throw new EvaluationError('Cannot access property of a non-object.');
                }

                const property = matches(expression.property, 'Identifier')
                    ? expression.property.name
                    : await this.evaluateExpression(expression.property, context);

                if (typeof property === 'number') {
                    if (!Array.isArray(object)) {
                        throw new EvaluationError('Cannot access array index of a non-array.');
                    }

                    if (property < 0 || property >= object.length) {
                        throw new UndefinedValueError('Array index is out of bounds.');
                    }

                    return object[property];
                }

                if (typeof property !== 'string') {
                    throw new EvaluationError(
                        `Property name must be a string, got ${HelpfulError.describeType(property)}.`,
                    );
                }

                if (!JsepExpressionEvaluator.isPropertyAllowed(object, property)) {
                    throw new UndefinedValueError(`Property \`${property}\` does not exist or is not accessible.`);
                }

                return object[property];
            }

            case matches(expression, 'CallExpression'): {
                const [fn, argumentValues] = await Promise.all([
                    this.getCallee(expression.callee, context),
                    Promise.all(expression.arguments.map(
                        argument => this.resolve(this.evaluateExpression(argument, context)),
                    )),
                ]);

                return fn(...expression.arguments.flatMap((argument, index) => {
                    const value = argumentValues[index];

                    if (matches(argument, 'SpreadElement')) {
                        if (!Array.isArray(value)) {
                            throw new EvaluationError(
                                'Spread argument must evaluate to an array, '
                                + `got ${HelpfulError.describeType(value)}.`,
                            );
                        }

                        return value;
                    }

                    return [value];
                }));
            }

            case matches(expression, 'ConditionalExpression'):
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- Intentional type juggling
                return await this.evaluateExpression(expression.test, context)
                    ? this.evaluateExpression(expression.consequent, context)
                    : this.evaluateExpression(expression.alternate, context);

            default:
                throw new EvaluationError(`Unexpected expression type \`${expression.type}\`.`);
        }
    }

    private async getCallee(expression: Expression, context?: EvaluationContext): Promise<GenericFunction> {
        if (matches(expression, 'Identifier')) {
            const fn = context?.functions?.[expression.name] ?? this.configuration.functions?.[expression.name];

            if (fn === undefined) {
                throw new EvaluationError(`Function \`${expression.name}\` does not exist.`);
            }

            return fn;
        }

        if (matches(expression, 'MemberExpression')) {
            const value = await this.resolve(this.evaluateExpression(expression.object, context));

            const property = matches(expression.property, 'Identifier')
                ? expression.property.name
                : await this.evaluateExpression(expression.property, context);

            if (typeof property !== 'string') {
                throw new EvaluationError(`Method name must be a string, got ${HelpfulError.describeType(property)}.`);
            }

            if (!JsepExpressionEvaluator.isMethodAllowed(value, property)) {
                throw new EvaluationError(`Method \`${property}\` does not exist or is not accessible.`);
            }

            return value[property].bind(value);
        }

        throw new EvaluationError('Callee is not callable.');
    }

    private static isMethodAllowed<T, M extends string>(value: T, method: M): value is MethodOwner<T, M> {
        if (typeof value === 'string') {
            return JsepExpressionEvaluator.ALLOWED_STRING_METHODS.includes(method as any);
        }

        if (Array.isArray(value)) {
            return JsepExpressionEvaluator.ALLOWED_ARRAY_METHODS.includes(method as any);
        }

        return false;
    }

    private static isPropertyAllowed<T, P extends string>(value: T, property: P): value is PropertyOwner<T, P> {
        if (typeof value === 'string') {
            return JsepExpressionEvaluator.ALLOWED_STRING_PROPERTIES.includes(property as any);
        }

        if (Array.isArray(value)) {
            return JsepExpressionEvaluator.ALLOWED_ARRAY_PROPERTIES.includes(property as any);
        }

        return typeof value === 'object'
            && value !== null
            && Object.hasOwn(value, property)
            && value[property as unknown as keyof T] !== undefined;
    }

    private async resolve(value: Deferrable<JsonValue>): Promise<JsonValue> {
        if (!(value instanceof Promise) && (typeof value !== 'object' || value === null)) {
            return value;
        }

        const resolvedValue = await value;

        if (Array.isArray(resolvedValue)) {
            return Promise.all(resolvedValue.map(item => this.resolve(item)));
        }

        if (typeof resolvedValue === 'object' && resolvedValue !== null) {
            const record = Object.fromEntries(
                await Promise.all(
                    Object.entries(resolvedValue).flatMap(([key, propertyValue]) => {
                        if (propertyValue === undefined) {
                            return [];
                        }

                        return [[key, this.resolve(propertyValue)]];
                    }),
                ),
            );

            if (Object.isFrozen(resolvedValue)) {
                Object.freeze(record);
            } else if (Object.isSealed(resolvedValue)) {
                Object.seal(record);
            }

            return record;
        }

        return resolvedValue;
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
        throw new EvaluationError(`Number expected, got ${HelpfulError.describeType(value)}.`);
    }

    return value;
}

async function expectBoolean(operand: LazyOperand): Promise<boolean> {
    const value = await operand();

    if (typeof value !== 'boolean') {
        throw new EvaluationError(`Boolean expected, got ${HelpfulError.describeType(value)}.`);
    }

    return value;
}
