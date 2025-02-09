import {JsonValue} from '@croct/json';
import {Action, ActionError, ActionRunner} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Resource, ResourceNotFoundError, ResourceProvider} from '@/application/provider/resourceProvider';
import {VariableMap} from '@/application/template/evaluation';
import {DeferredOptionDefinition, DeferredTemplate} from '@/application/template/template';
import {Deferrable} from '@/application/template/deferral';

export type ImportOptions = {
    template: string,
    options?: VariableMap,
};

export type Configuration = {
    runner: ActionRunner,
    templateProvider: ResourceProvider<DeferredTemplate>,
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
        const {value: template, url} = await this.loadTemplate(options.template, context.baseUrl);

        const input = await this.getInputValues(template, options.options);

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

    private async getInputValues(template: DeferredTemplate, input: VariableMap = {}): Promise<VariableMap> {
        const values: VariableMap = {};

        for (const [name, definition] of Object.entries(template.options ?? {})) {
            const value = input[name];

            if (value === undefined && definition.required === true) {
                throw new ActionError(`Missing required option \`${name}\`.`, {
                    reason: ErrorReason.INVALID_INPUT,
                });
            }

            const resolvedValue = await (value ?? definition.resolveDefault?.(this.config.variables));

            if (resolvedValue !== undefined) {
                ImportAction.checkOptionValue(name, resolvedValue, definition);

                values[name] = resolvedValue;
            }
        }

        return values;
    }

    private async run(template: DeferredTemplate, options: VariableMap, context: ActionContext): Promise<void> {
        const {runner, variables} = this.config;
        const {output} = context;

        for (const {resolve} of template.actions) {
            const notifier = output.notify('Resolving options');

            let action: Deferrable<JsonValue>;

            try {
                action = await resolve({
                    ...variables,
                    options: options,
                    get this() {
                        // Defer the variable resolution to the last moment to allow nested actions
                        // to access variables set by previous actions
                        return context.getVariables();
                    },
                });
            } catch (error) {
                throw ActionError.fromCause('Unable to resolve action definition.');
            }

            try {
                notifier.stop();

                await runner.execute({actions: [action]}, context);
            } catch (error) {
                const name = await ImportAction.getActionName(action);

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

    private async loadTemplate(name: string, baseUrl: URL): Promise<Resource<DeferredTemplate>> {
        const provider = this.config.templateProvider;
        const url = ImportAction.getTemplateUrl(name, baseUrl);

        try {
            return await provider.get(url);
        } catch (error) {
            if (error instanceof ResourceNotFoundError) {
                throw new HelpfulError(`Template not found at \`${url}\`.`, {
                    cause: error,
                    reason: ErrorReason.INVALID_INPUT,
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
                        + `but got ${HelpfulError.describeType(value)}.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                        },
                    );
                }

                if (
                    definition.type === 'string'
                    && definition.options !== undefined
                    && !definition.options.includes(value as string)
                ) {
                    throw new ActionError(
                        `Invalid value for option \`${name}\`.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                            details: [
                                `Allowed values: \`${definition.options.join('`, `')}\`.`,
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
                        + `but got ${HelpfulError.describeType(value)}.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                        },
                    );
                }

                break;
            }

            case 'object': {
                if (typeof value !== 'object' || value === null) {
                    throw new ActionError(
                        `Expected value of type ${definition.type} for option \`${name}\`,`
                        + `but got ${HelpfulError.describeType(value)}.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                        },
                    );
                }

                break;
            }
        }
    }

    private static async getActionName(action: Deferrable<JsonValue>): Promise<string> {
        if (typeof action === 'object' && action !== null && 'name' in action) {
            const name = await action.name;

            if (typeof name === 'string') {
                return name;
            }
        }

        return 'unknown';
    }
}
