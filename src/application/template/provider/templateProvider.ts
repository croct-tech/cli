import {JsonArray, JsonObject, JsonValue} from '@croct/json';
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
import {ErrorReason} from '@/application/error';
import {Validator} from '@/application/validation';
import {DeferredTemplate, Template} from '@/application/template/template';
import {Provider, ProviderError, ProviderOptions} from '@/application/template/provider/provider';
import {Fragment, JsonExpressionNode, TemplateStringParser} from '@/application/template/templateStringParser';

export type Configuration<O extends ProviderOptions> = {
    evaluator: ExpressionEvaluator,
    validator: Validator<Template>,
    provider: Provider<string, O>,
};

type DeferredOptions = DeferredTemplate['options'];
type Options = Template['options'];

export class TemplateProvider<O extends ProviderOptions> implements Provider<DeferredTemplate, O> {
    private readonly evaluator: ExpressionEvaluator;

    private readonly validator: Validator<Template>;

    private readonly provider: Provider<string, O>;

    private readonly loading: string[] = [];

    public constructor({evaluator, validator, provider}: Configuration<O>) {
        this.evaluator = evaluator;
        this.validator = validator;
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL): Promise<DeferredTemplate> {
        const source = await this.provider.get(url);

        let node: JsonObjectNode;

        try {
            node = JsonParser.parse(source, JsonObjectNode);
        } catch (error) {
            throw new ProviderError('Failed to parse the JSON template.', url, {
                reason: ErrorReason.INVALID_INPUT,
                cause: error,
            });
        }

        const data = node.toJSON();
        const validation = this.validator.validate(data);

        if (!validation.valid) {
            const violations = validation.violations
                .map(violation => ` • ${violation.path}: ${violation.message}`)
                .join('\n');

            throw new ProviderError(`Invalid template:\n\n${violations}`, url, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        const {options, actions, ...metadata} = validation.data;
        const actionsNode = node.get('actions', JsonArrayNode);
        const resolvedOptions = this.parseOptions(node, options, url);

        return {
            ...metadata,
            ...(resolvedOptions !== undefined ? {options: resolvedOptions} : {}),
            actions: actionsNode.elements.map(
                (definition, index) => ({
                    name: actions[index].name,
                    resolve: variables => this.resolve(definition.cast(JsonObjectNode), variables, url),
                }),
            ),
        };
    }

    private parseOptions(node: JsonObjectNode, options: Options, baseUrl: URL): DeferredOptions {
        if (options === undefined) {
            return undefined;
        }

        const optionsNode = node.get('options', JsonObjectNode);

        return Object.fromEntries(
            Object.entries(options).map<[string, NonNullable<DeferredOptions>[number]]>(
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

    private resolve(node: JsonObjectNode, variables: VariableMap, baseUrl: URL): Promise<JsonObject>;

    private resolve(node: JsonArrayNode, variables: VariableMap, baseUrl: URL): Promise<JsonArray>;

    private resolve(node: JsonValueNode, variables: VariableMap, baseUrl: URL): Promise<JsonValue>;

    private async resolve(node: JsonValueNode, variables: VariableMap, baseUrl: URL): Promise<JsonValue> {
        if (node instanceof JsonArrayNode) {
            return Promise.all(node.elements.map(element => this.resolve(element, variables, baseUrl)));
        }

        if (node instanceof JsonObjectNode) {
            return Object.fromEntries(
                await Promise.all(
                    node.properties.map(async property => {
                        const [key, value] = await Promise.all([
                            this.interpolate(property.key, variables, baseUrl),
                            this.resolve(property.value, variables, baseUrl),
                        ]);

                        if (typeof key !== 'string' && typeof key !== 'number') {
                            const location = property.key.location.start;

                            throw new ProviderError(
                                'Expected object key to resolve to string or number, '
                                + `but got ${TemplateProvider.getType(key)}.`,
                                baseUrl,
                                {
                                    reason: ErrorReason.INVALID_INPUT,
                                    details: [
                                        `Location: line ${location.line}, column ${location.column}`,
                                    ],
                                },
                            );
                        }

                        return [key, value];
                    }),
                ),
            );
        }

        if (node instanceof JsonPrimitiveNode && typeof node.value === 'string') {
            return this.interpolate(node, variables, baseUrl);
        }

        return node.toJSON();
    }

    private async interpolate(node: JsonExpressionNode, variables: VariableMap, baseUrl: URL): Promise<JsonValue> {
        const fragments = TemplateStringParser.parse(node);

        if (fragments.length === 1) {
            const fragment = fragments[0];

            if (fragment.type === 'literal') {
                return fragment.source;
            }

            return this.evaluate(TemplateProvider.createExpressionNode(fragment), variables, baseUrl);
        }

        return (await Promise.all(
            fragments.map(async fragment => {
                if (fragment.type === 'literal') {
                    return fragment.source;
                }

                const expressionNode = TemplateProvider.createExpressionNode(fragment);

                const result = await this.evaluate(expressionNode, variables, baseUrl);

                if (result !== null && !['string', 'number', 'boolean'].includes(typeof result)) {
                    const location = node.location.start;

                    throw new ProviderError(
                        `Expected expression \`${fragment.expression}\` to resolve to null, string, number, or `
                        + `boolean value, but got ${TemplateProvider.getType(result)}.`,
                        baseUrl,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                            details: [
                                `Location: line ${location.line}, column ${location.column}`,
                            ],
                        },
                    );
                }

                return `${result ?? ''}`;
            }),
        )).join('');
    }

    public async evaluate(node: JsonExpressionNode, variables: VariableMap, baseUrl: URL): Promise<JsonValue> {
        const expression = (node instanceof JsonIdentifierNode ? node.token.value : node.value).trim();

        try {
            return await this.evaluator.evaluate(expression, {
                variables: variables,
                functions: {
                    import: (url?: JsonValue, input?: JsonValue): Promise<JsonValue> => {
                        if (typeof url !== 'string') {
                            throw new ProviderError(
                                'The first argument of the `import` function must be a string, but got '
                                + `${TemplateProvider.getType(url)}.`,
                                baseUrl,
                                {
                                    reason: ErrorReason.INVALID_INPUT,
                                },
                            );
                        }

                        if (
                            input !== undefined
                            && (typeof input !== 'object' || input === null || Array.isArray(input))
                        ) {
                            throw new ProviderError(
                                'The second argument of the `import` function must be an object, but got '
                                + `${TemplateProvider.getType(input)}.`,
                                baseUrl,
                                {
                                    reason: ErrorReason.INVALID_INPUT,
                                },
                            );
                        }

                        return this.import(
                            TemplateProvider.getSourceUrl(url, baseUrl),
                            {
                                ...variables,
                                input: {
                                    ...input,
                                    ...(
                                        typeof variables.input === 'object' && variables.input !== null
                                            ? variables.input
                                            : {}
                                    ),
                                },
                            },
                        );
                    },
                },
            });
        } catch (error) {
            const location = node.location.start;

            throw new ProviderError(
                `Failed to evaluate expression \`${expression}\`.`,
                baseUrl,
                {
                    reason: ErrorReason.INVALID_INPUT,
                    cause: error,
                    details: [
                        `Location: line ${location.line}, column ${location.column}`,
                    ],
                },
            );
        }
    }

    private async import(url: URL, variables: VariableMap): Promise<JsonValue> {
        if (this.loading.includes(url.toString())) {
            const chain = [...this.loading, url.href].map((path, index) => ` ${index + 1}. ${path}`)
                .join('\n');

            throw new ProviderError(`Circular dependency detected while loading templates:\n\n${chain}`, url, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        const template = await this.provider.get(url);

        let node: JsonValueNode;

        try {
            node = JsonParser.parse(template);
        } catch (error) {
            throw new ProviderError('Failed to parse referenced JSON.', url, {
                reason: ErrorReason.INVALID_INPUT,
                cause: error,
            });
        }

        this.loading.push(url.toString());

        try {
            return this.resolve(node, variables, url);
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
