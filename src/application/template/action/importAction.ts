import {JsonValue} from '@croct/json';
import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason, HelpfulError} from '@/application/error';
import {ResourceNotFoundError, ResourceProvider} from '@/application/provider/resourceProvider';
import {LazyJsonValue, VariableMap} from '@/application/template/evaluation';
import {DeferredOptionDefinition, DeferredTemplate} from '@/application/template/template';

export type ImportOptions = {
    template: string,
    input?: VariableMap,
};

type DeferredTemplateSource = {
    url: URL,
    template: DeferredTemplate,
};

export type Configuration = {
    actions: Record<string, Action>,
    templateProvider: ResourceProvider<DeferredTemplateSource>,
    variables: VariableMap,
};

export class ImportAction implements Action<ImportOptions> {
    private readonly config: Configuration;

    private readonly resolving: string[] = [];

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: ImportOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output.notify('Loading template');

        try {
            await this.importTemplate(options, context);
        } finally {
            notifier.stop();
        }
    }

    private async importTemplate(options: ImportOptions, context: ActionContext): Promise<void> {
        const {template, url} = await this.loadTemplate(options.template, context.baseUrl);

        const input = this.getInputValues(template, options.input);

        if (this.resolving.includes(url.href)) {
            const chain = [...this.resolving, url.href].map((path, index) => ` ${index + 1}. ${path}`)
                .join('\n');

            throw new ActionError(`Circular dependency detected while loading templates:\n\n${chain}`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        this.resolving.push(url.toString());

        try {
            await this.run(
                template,
                input,
                new ActionContext({
                    input: context.input,
                    output: context.output,
                    baseUrl: url,
                }),
            );
        } finally {
            this.resolving.pop();
        }
    }

    private getInputValues(template: DeferredTemplate, input: VariableMap = {}): VariableMap {
        const values: VariableMap = {};

        for (const [name, definition] of Object.entries(template.options ?? {})) {
            const value = input[name];

            if (value === undefined && definition.required === true) {
                throw new ActionError(`Missing required option \`${name}\`.`, {
                    reason: ErrorReason.INVALID_INPUT,
                });
            }

            const {resolveDefault} = definition;

            let optionValue = value ?? (
                resolveDefault !== undefined
                    ? (): Promise<JsonValue> => resolveDefault(this.config.variables)
                    : undefined
            );

            if (typeof optionValue === 'function') {
                const lazyValue: LazyJsonValue = optionValue;

                optionValue = async (): Promise<JsonValue> => {
                    const resolvedValue = await lazyValue();

                    ImportAction.checkOptionValue(name, resolvedValue, definition);

                    return resolvedValue;
                };
            } else {
                ImportAction.checkOptionValue(name, optionValue, definition);
            }

            values[name] = optionValue;
        }

        return values;
    }

    private async run(template: DeferredTemplate, input: VariableMap, context: ActionContext): Promise<void> {
        const {actions, variables} = this.config;
        const {output} = context;

        for (const {name, resolve} of template.actions) {
            const action = actions[name];

            if (action === undefined) {
                throw new HelpfulError(`Unknown action \`${name}\`.`, {
                    reason: ErrorReason.INVALID_INPUT,
                });
            }

            const notifier = output.notify('Resolving options');

            try {
                const resolvedOptions = await resolve({
                    ...variables,
                    input: input,
                    output: context.getVariables(),
                });

                notifier.stop();

                await action.execute(resolvedOptions, context);
            } catch (error) {
                throw ActionError.fromCause(error, {
                    details: [
                        `Action: \`${name}\` from ${context.baseUrl}`,
                        ...(error instanceof HelpfulError ? error.help.details ?? [] : []),
                    ],
                });
            } finally {
                notifier.stop();
            }
        }
    }

    private async loadTemplate(name: string, baseUrl: URL): Promise<DeferredTemplateSource> {
        const provider = this.config.templateProvider;
        const url = ImportAction.getTemplateUrl(name, baseUrl);

        try {
            return await provider.get(url);
        } catch (error) {
            if (error instanceof ResourceNotFoundError) {
                throw new HelpfulError('Template not found.', {
                    cause: error,
                    reason: ErrorReason.INVALID_INPUT,
                    details: [
                        `Template: ${name}`,
                    ],
                    suggestions: [
                        'Check if the template path or URL is correct and try again.',
                    ],
                });
            }

            throw error;
        }
    }

    private static getTemplateUrl(source: string, baseUrl: URL): URL {
        if (URL.canParse(source)) {
            return new URL(source);
        }

        const url = new URL(baseUrl);

        url.pathname = `${url.pathname.replace(/\/([^/]*\.[^/]+)?$/, '')}/${source}`;

        return url;
    }

    private static checkOptionValue(
        name: string,
        value: unknown,
        definition: DeferredOptionDefinition,
    ): asserts value is JsonValue {
        switch (definition.type) {
            case 'number':
            case 'string':
            case 'boolean': {
                // eslint-disable-next-line valid-typeof -- Statically checked
                if (typeof value !== definition.type) {
                    throw new ActionError(
                        `Expected value of type ${definition.type} for option \`${name}\`, `
                        + `but got ${ImportAction.getType(value)}.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                        },
                    );
                }

                if (
                    definition.type === 'string'
                    && definition.choices !== undefined
                    && !definition.choices.includes(value as string)
                ) {
                    throw new ActionError(
                        `Invalid value for option \`${name}\`.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                            details: [
                                `Allowed values: \`${definition.choices.join('`, `')}\`.`,
                            ],
                        },
                    );
                }

                break;
            }

            case 'array': {
                if (!Array.isArray(value)) {
                    throw new ActionError(
                        `Expected value of type ${definition.type} for option \`${name}\`,`
                        + `but got ${ImportAction.getType(value)}.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                        },
                    );
                }

                for (const [index, element] of value.entries()) {
                    if (!['number', 'string', 'boolean'].includes(typeof element)) {
                        throw new ActionError(
                            `Expected array elements to be of type number, string, or boolean for option \`${name}\`,`
                            + `but got ${ImportAction.getType(element)} at index ${index}.`,
                            {
                                reason: ErrorReason.INVALID_INPUT,
                            },
                        );
                    }
                }

                break;
            }
        }
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
