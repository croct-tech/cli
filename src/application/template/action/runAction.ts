import {JsonParseError} from '@croct/json5-parser';
import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason} from '@/application/error';
import {ActionDefinition, SourceLocation} from '@/application/template/template';
import {TemplateError} from '@/application/template/templateProvider';

export type RunOptions = {
    actions: ActionDefinition|ActionDefinition[],
};

export class RunAction implements Action<RunOptions> {
    private readonly actions: Record<string, Action>;

    public constructor(actions: Record<string, Action>) {
        this.actions = actions;
    }

    public async execute(options: RunOptions, context: ActionContext): Promise<void> {
        for (const action of Array.isArray(options.actions) ? options.actions : [options.actions]) {
            try {
                await this.run(action, context);
            } catch (error) {
                if (error instanceof TemplateError && error.help.cause instanceof JsonParseError) {
                    const {location} = error.help.cause;

                    throw ActionError.fromCause(error, {
                        tracing: [
                            {
                                name: action.name,
                                source: {
                                    url: error.url,
                                    start: location.start,
                                    end: location.end,
                                },
                            },
                        ],
                    });
                }

                throw ActionError.fromCause(error, {
                    tracing: [
                        {
                            name: action.name,
                            source: SourceLocation.get(action) ?? undefined,
                        },
                    ],
                });
            }
        }
    }

    private run({name, ...options}: ActionDefinition, context: ActionContext): Promise<void> {
        const action = this.actions[name];

        if (action === undefined) {
            throw new ActionError(`Unsupported action \`${name}\`.`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        return action.execute(options, context);
    }
}
