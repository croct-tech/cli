import {Action, ActionDefinition, ActionError, ActionMap, ActionName} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {Help} from '@/application/error';

export type TryOptions<T extends ActionName = ActionName> = {
    action: ActionDefinition<T>,
    otherwise?: ActionDefinition<T>,
    help?: Pick<Help, | 'links' | 'suggestions'> & {
        message?: string,
    },
};

export class Try<T extends ActionName> implements Action<TryOptions<T>> {
    private readonly actions: ActionMap<T>;

    public constructor(actions: ActionMap<T>) {
        this.actions = actions;
    }

    public async execute(options: TryOptions<T>, context: ActionContext): Promise<void> {
        try {
            await this.actions[options.action.name].execute(options.action, context);
        } catch (error) {
            if (options.otherwise === undefined) {
                if (options.help === undefined) {
                    throw error;
                }

                const {help} = options;

                const [message, suggestions, links] = await Promise.all([
                    help.message !== undefined
                        ? context.resolveString(help.message)
                        : error.message,
                    help?.suggestions !== undefined
                        ? Promise.all(help.suggestions.map(suggestion => context.resolveString(suggestion)))
                        : undefined,
                    help?.links !== undefined
                        ? Promise.all(
                            help.links.map(
                                async link => {
                                    const [url, description] = await Promise.all([
                                        context.resolveString(link.url),
                                        context.resolveString(link.description),
                                    ]);

                                    return {
                                        url: url,
                                        description: description,
                                    };
                                },
                            ),
                        )
                        : undefined,
                ]);

                throw ActionError.fromCause(error, {
                    message: message,
                    suggestions: suggestions,
                    links: links,
                });
            }

            return this.actions[options.otherwise.name].execute(options.otherwise, context);
        }
    }
}

declare module '@/application/template/action/action' {
    export interface ActionOptionsMap {
        'try': TryOptions;
    }
}
