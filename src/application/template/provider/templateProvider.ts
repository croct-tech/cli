import {JsonValue} from '@croct/json';
import {
    JsonArrayNode,
    JsonIdentifierNode,
    JsonObjectNode,
    JsonParser,
    JsonPrimitiveNode,
    JsonTokenNode,
    JsonTokenType,
    JsonValueNode,
} from '@/infrastructure/json';
import {ExpressionEvaluator, VariableMap} from '@/application/template/evaluation';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Validator, Violation} from '@/application/validation';
import {DeferredTemplate, Template} from '@/application/template/template';
import {ResourceProvider, ResourceProviderError, ResourceHelp, Resource} from '@/application/provider/resourceProvider';
import {Fragment, JsonExpressionNode, TemplateStringParser} from '@/application/template/templateStringParser';
import {Deferred, Deferrable} from '@/application/template/deferral';
import {LazyPromise} from '@/infrastructure/promise';

export type Configuration = {
    evaluator: ExpressionEvaluator,
    validator: Validator<Template>,
    provider: ResourceProvider<string>,
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

    private readonly provider: ResourceProvider<string>;

    private readonly loading: string[] = [];

    public constructor({evaluator, validator, provider}: Configuration) {
        this.evaluator = evaluator;
        this.validator = validator;
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL): Promise<Resource<DeferredTemplate>> {
        const {url: resolvedUrl, value: source} = await this.provider.get(url);

        let node: JsonObjectNode;

        try {
            node = JsonParser.parse(source, JsonObjectNode);
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
                (element, index) => LazyPromise.from(
                    () => this.resolve(element, variables, baseUrl, `${path}[${index}]`),
                ),
            );
        }

        if (node instanceof JsonObjectNode) {
            return LazyPromise.from(
                async () => Object.fromEntries(
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
                                                    + `got ${TemplateProvider.getType(key)}.`,
                                            },
                                        ],
                                    },
                                );
                            }

                            const propertyPath = path === '' ? `${key}` : `${path}.${key}`;

                            return [
                                key,
                                LazyPromise.from(() => this.resolve(property.value, variables, baseUrl, propertyPath)),
                            ];
                        }),
                    ),
                ),
            );
        }

        if (node instanceof JsonPrimitiveNode && typeof node.value === 'string') {
            return this.interpolate(node, variables, baseUrl, path);
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

            return LazyPromise.transient(
                () => this.evaluate(
                    TemplateProvider.createExpressionNode(fragment),
                    variables,
                    baseUrl,
                    path,
                ),
            );
        }

        return LazyPromise.from(
            async () => (await Promise.all(
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
                                        + `column ${location.column}, but got ${TemplateProvider.getType(result)}.`,
                                },
                            ],
                        });
                    }

                    return `${result ?? ''}`;
                }),
            )).join(''),
        );
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
                    import: (url?: JsonValue, properties?: JsonValue): Deferred<JsonValue> => {
                        if (typeof url !== 'string') {
                            const location = node.location.start;

                            throw new TemplateError('Invalid argument for function `import`.', {
                                reason: ErrorReason.INVALID_INPUT,
                                url: baseUrl,
                                violations: [
                                    {
                                        path: path,
                                        message: 'The first argument of the `import` function must be a string, '
                                            + `but got ${TemplateProvider.getType(url)} at line ${location.line}, `
                                            + `column ${location.column}.`,
                                    },
                                ],
                            });
                        }

                        if (
                            properties !== undefined
                            && (typeof properties !== 'object' || properties === null || Array.isArray(properties))
                        ) {
                            const location = node.location.start;

                            throw new TemplateError('Invalid argument for function `import`.', {
                                reason: ErrorReason.INVALID_INPUT,
                                url: baseUrl,
                                violations: [
                                    {
                                        path: path,
                                        message: 'The second argument of the `import` function must be an object. '
                                            + `but got ${TemplateProvider.getType(url)} at line ${location.line}, `
                                            + `column ${location.column}.`,
                                    },
                                ],
                            });
                        }

                        return this.import(
                            TemplateProvider.getSourceUrl(url, baseUrl),
                            {
                                ...variables,
                                this: {
                                    ...properties,
                                    ...(
                                        typeof variables.this === 'object' && variables.this !== null
                                            ? variables.this
                                            : {}
                                    ),
                                },
                            },
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

        const {url: resolvedUrl, value} = await this.provider.get(url);

        let node: JsonValueNode;

        try {
            node = JsonParser.parse(value);
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

    private static getSourceUrl(source: string, baseUrl: URL): URL {
        if (URL.canParse(source)) {
            return new URL(source);
        }

        const url = new URL(baseUrl);

        url.pathname = `${url.pathname.replace(/\/([^/]*\.[^/]+)?$/, '')}/${source}`;

        return url;
    }

    private static getType(value: unknown): string {
        if (value === null) {
            return 'null';
        }

        if (Array.isArray(value)) {
            return 'array';
        }

        return typeof value;
    }
}
