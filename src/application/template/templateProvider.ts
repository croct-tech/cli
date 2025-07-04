import {JsonValue} from '@croct/json';
import {
    JsonArrayNode,
    JsonIdentifierNode,
    JsonNode,
    JsonObjectNode,
    JsonParser,
    JsonPrimitiveNode,
    JsonTokenNode,
    JsonTokenType,
    JsonValueNode,
} from '@croct/json5-parser';
import {EvaluationError, ExpressionEvaluator, VariableMap} from '@/application/template/evaluation';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Validator, Violation} from '@/application/validation';
import {DeferredTemplate, SourceLocation, Template} from '@/application/template/template';
import {
    ResourceProvider,
    ResourceProviderError,
    ResourceHelp,
    Resource,
} from '@/application/provider/resource/resourceProvider';
import {Fragment, JsonExpressionNode, TemplateStringParser} from '@/application/template/templateStringParser';
import {Deferred, Deferrable} from '@/application/template/deferral';
import {LazyPromise} from '@/infrastructure/promise';
import {resolveUrl} from '@/utils/resolveUrl';

export type Configuration = {
    evaluator: ExpressionEvaluator,
    validator: Validator<Template>,
    templateProvider: ResourceProvider<string>,
    fileProvider: ResourceProvider<string>,
};

type DeferredTemplateOptions = DeferredTemplate['options'];
type TemplateOptions = Template['options'];

type TemplateHelp = ResourceHelp & {
    violations: Violation[],
};

export class TemplateError extends ResourceProviderError {
    public readonly violations: Violation[];

    public constructor(message: string, {violations, ...help}: TemplateHelp) {
        super(message, help);

        this.violations = violations;

        Object.setPrototypeOf(this, TemplateError.prototype);
    }
}

export class TemplateProvider implements ResourceProvider<DeferredTemplate> {
    private readonly evaluator: ExpressionEvaluator;

    private readonly validator: Validator<Template>;

    private readonly templateProvider: ResourceProvider<string>;

    private readonly fileProvider: ResourceProvider<string>;

    private readonly loading: string[] = [];

    public constructor({evaluator, validator, templateProvider, fileProvider}: Configuration) {
        this.evaluator = evaluator;
        this.validator = validator;
        this.templateProvider = templateProvider;
        this.fileProvider = fileProvider;
    }

    public async get(url: URL): Promise<Resource<DeferredTemplate>> {
        const {url: resolvedUrl, value: source} = await this.templateProvider.get(url);

        let node: JsonObjectNode;

        try {
            node = TemplateProvider.cleanJson(JsonParser.parse(source, JsonObjectNode));
        } catch (error) {
            throw new TemplateError('Failed to parse the JSON template.', {
                reason: ErrorReason.INVALID_INPUT,
                url: resolvedUrl,
                cause: error,
                violations: [
                    {
                        path: '',
                        message: HelpfulError.formatMessage(error),
                    },
                ],
            });
        }

        const data = node.toJSON();

        const validation = await this.validator.validate(data);

        if (!validation.valid) {
            const violations = validation.violations
                .map(violation => ` • **${violation.path}**: ${violation.message}`)
                .join('\n\n');

            throw new TemplateError(`The template contains errors:\n\n${violations}`, {
                reason: ErrorReason.INVALID_INPUT,
                url: resolvedUrl,
                violations: validation.violations,
            });
        }

        const {options, actions, ...metadata} = validation.data;
        const actionsNode = node.get('actions', JsonArrayNode);
        const resolvedOptions = this.parseOptions(node, options, resolvedUrl);

        return {
            url: resolvedUrl,
            value: {
                ...metadata,
                ...(resolvedOptions !== undefined ? {options: resolvedOptions} : {}),
                actions: actionsNode.elements.map(
                    definition => ({
                        resolve: variables => this.resolve(definition, variables, resolvedUrl),
                    }),
                ),
            },
        };
    }

    private parseOptions(node: JsonObjectNode, options: TemplateOptions, baseUrl: URL): DeferredTemplateOptions {
        if (options === undefined) {
            return undefined;
        }

        const optionsNode = node.get('options', JsonObjectNode);

        return Object.fromEntries(
            Object.entries(options).map(
                ([name, definition]) => {
                    if (definition.default === undefined) {
                        return [name, definition];
                    }

                    const defaultValueNode = optionsNode.get(name, JsonObjectNode)
                        .get('default');

                    return [
                        name,
                        {
                            ...definition,
                            resolveDefault: variables => this.resolve(defaultValueNode, variables, baseUrl),
                        },
                    ];
                },
            ),
        );
    }

    private resolve(node: JsonValueNode, variables: VariableMap, baseUrl: URL, path = ''): Deferrable<JsonValue> {
        if (node instanceof JsonArrayNode) {
            return node.elements.map(
                (element, index) => this.resolve(element, variables, baseUrl, `${path}[${index}]`),
            );
        }

        if (node instanceof JsonObjectNode) {
            return LazyPromise.transient(
                async () => {
                    const object = Object.fromEntries(
                        await Promise.all(
                            node.properties.map(async property => {
                                const key = await this.interpolate(property.key, variables, baseUrl, path);

                                if (typeof key !== 'string' && typeof key !== 'number') {
                                    const location = property.key.location.start;

                                    throw new TemplateError(
                                        'Unexpected object key type.',
                                        {
                                            url: baseUrl,
                                            reason: ErrorReason.INVALID_INPUT,
                                            violations: [
                                                {
                                                    path: path,
                                                    message: 'Expected object key to resolve to string or number at '
                                                        + `line ${location.line}, column ${location.column} but `
                                                        + `got ${HelpfulError.describeType(key)}.`,
                                                },
                                            ],
                                        },
                                    );
                                }

                                const propertyPath = path === '' ? `${key}` : `${path}.${key}`;

                                return [
                                    key,
                                    LazyPromise.transient(
                                        () => this.resolve(property.value, variables, baseUrl, propertyPath),
                                    ),
                                ];
                            }),
                        ),
                    );

                    SourceLocation.set(object, {
                        url: baseUrl,
                        start: node.location.start,
                        end: node.location.end,
                    });

                    return object;
                },
            );
        }

        if (node instanceof JsonPrimitiveNode && typeof node.value === 'string') {
            return LazyPromise.transient(() => this.interpolate(node, variables, baseUrl, path));
        }

        return node.toJSON();
    }

    private interpolate(
        node: JsonExpressionNode,
        variables: VariableMap,
        baseUrl: URL,
        path: string,
    ): Deferrable<JsonValue> {
        const fragments = TemplateStringParser.parse(node);

        if (fragments.length === 1) {
            const fragment = fragments[0];

            if (fragment.type === 'literal') {
                return fragment.source;
            }

            return this.evaluate(
                TemplateProvider.createExpressionNode(fragment),
                variables,
                baseUrl,
                path,
            );
        }

        return Promise.all(
            fragments.map(async fragment => {
                if (fragment.type === 'literal') {
                    return fragment.source;
                }

                const expressionNode = TemplateProvider.createExpressionNode(fragment);

                const result = await this.evaluate(expressionNode, variables, baseUrl, path);

                if (result !== null && !['string', 'number', 'boolean'].includes(typeof result)) {
                    const location = node.location.start;

                    throw new TemplateError('Unexpected expression result.', {
                        reason: ErrorReason.INVALID_INPUT,
                        url: baseUrl,
                        violations: [
                            {
                                path: path,
                                message: `Expected expression \`${fragment.expression}\` to resolve to null, `
                                    + `string, number, or boolean value at line ${location.line}, `
                                    + `column ${location.column}, but got ${HelpfulError.describeType(result)}.`,
                            },
                        ],
                    });
                }

                return `${result ?? ''}`;
            }),
        ).then(parts => parts.join(''));
    }

    public async evaluate(
        node: JsonExpressionNode,
        variables: VariableMap,
        baseUrl: URL,
        path: string,
    ): Deferred<JsonValue> {
        const expression = (node instanceof JsonIdentifierNode ? node.token.value : node.value).trim();

        try {
            return await this.evaluator.evaluate(expression, {
                variables: variables,
                functions: {
                    url: (url: JsonValue = ''): Deferrable<JsonValue> => {
                        if (typeof url !== 'string') {
                            const location = node.location.start;

                            throw new EvaluationError('Invalid argument for function `url`.', {
                                reason: ErrorReason.INVALID_INPUT,
                                details: [
                                    'The `url` argument of the `url` function must be a string, '
                                    + `but got ${HelpfulError.describeType(url)} at line ${location.line}, `
                                    + `column ${location.column}.`,
                                ],
                            });
                        }

                        return resolveUrl(url, baseUrl).toString();
                    },
                    import: (url?: JsonValue, properties?: JsonValue): Deferrable<JsonValue> => {
                        if (typeof url !== 'string') {
                            const location = node.location.start;

                            throw new EvaluationError('Invalid argument for function `import`.', {
                                reason: ErrorReason.INVALID_INPUT,
                                details: [
                                    'The `url` argument of the `import` function must be a string, '
                                    + `but got ${HelpfulError.describeType(url)} at line ${location.line}, `
                                    + `column ${location.column}.`,
                                ],
                            });
                        }

                        if (
                            properties !== undefined
                            && (typeof properties !== 'object' || properties === null || Array.isArray(properties))
                        ) {
                            const location = node.location.start;

                            throw new EvaluationError('Invalid argument for function `import`.', {
                                reason: ErrorReason.INVALID_INPUT,
                                details: [
                                    'The `properties` argument of the `import` function must be an object, '
                                    + `but got ${HelpfulError.describeType(url)} at line ${location.line}, `
                                    + `column ${location.column}.`,
                                ],
                            });
                        }

                        return this.import(
                            resolveUrl(url, baseUrl),
                            properties === undefined
                                ? variables
                                : VariableMap.merge(variables, {
                                    this: Promise.resolve(variables.this).then(
                                        resolvedValue => (
                                            typeof resolvedValue === 'object'
                                                && resolvedValue !== null
                                                && !Array.isArray(resolvedValue)
                                                ? VariableMap.merge(resolvedValue, properties)
                                                : properties
                                        ),
                                    ),
                                }),
                            baseUrl,
                            path,
                        );
                    },
                },
            });
        } catch (error) {
            const location = node.location.start;

            throw new TemplateError('Failed to evaluate expression.', {
                reason: ErrorReason.INVALID_INPUT,
                url: baseUrl,
                cause: error,
                violations: [
                    {
                        path: path,
                        message: `Evaluation of \`${expression}\` at line ${location.line}, column ${location.column} `
                         + `failed because ${HelpfulError.formatCause(error)}`,
                    },
                ],
            });
        }
    }

    private async import(url: URL, variables: VariableMap, baseUrl: URL, path: string): Deferred<JsonValue> {
        if (url.protocol === 'file:' && baseUrl.protocol !== 'file:') {
            throw new TemplateError('Unsafe import URL.', {
                reason: ErrorReason.PRECONDITION,
                url: url,
                violations: [
                    {
                        path: path,
                        message: 'File URL is not allowed from remote sources for security reasons.',
                    },
                ],
            });
        }

        if (this.loading.includes(url.toString())) {
            const chain = [...this.loading, url.href].map((dependency, index) => ` ${index + 1}. ${dependency}`)
                .join('\n');

            throw new TemplateError(`Circular dependency detected while loading templates:\n\n${chain}`, {
                reason: ErrorReason.INVALID_INPUT,
                url: url,
                violations: [
                    {
                        path: path,
                        message: 'Imported template creates a circular dependency.',
                    },
                ],
            });
        }

        const {url: resolvedUrl, value} = await this.fileProvider.get(url);

        let node: JsonValueNode;

        try {
            node = TemplateProvider.cleanJson(JsonParser.parse(value));
        } catch (error) {
            throw new TemplateError('Failed to parse referenced JSON.', {
                reason: ErrorReason.INVALID_INPUT,
                cause: error,
                url: resolvedUrl,
                violations: [
                    {
                        path: path,
                        message: HelpfulError.formatMessage(error),
                    },
                ],
            });
        }

        this.loading.push(resolvedUrl.toString());

        try {
            return this.resolve(node, variables, resolvedUrl, path);
        } finally {
            this.loading.pop();
        }
    }

    private static createExpressionNode(fragment: Fragment<'expression'>): JsonPrimitiveNode<JsonTokenType.STRING> {
        return new JsonPrimitiveNode({
            value: fragment.expression,
            location: fragment.location,
            token: new JsonTokenNode({
                type: JsonTokenType.STRING,
                value: fragment.source,
                location: fragment.location,
            }),
        });
    }

    private static cleanJson<T extends JsonNode>(node: T): T {
        if (node instanceof JsonPrimitiveNode) {
            return node;
        }

        if (node instanceof JsonArrayNode) {
            for (const element of node.elements) {
                this.cleanJson(element);
            }

            return node;
        }

        if (node instanceof JsonObjectNode) {
            for (const property of node.properties) {
                const key = property.key.toJSON();

                if (key === '$schema') {
                    node.delete(key);
                } else {
                    this.cleanJson(property.value);
                }
            }
        }

        return node;
    }
}
