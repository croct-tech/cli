import {JsonPrimitive} from '@croct/json';
import {Action} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';

export type DefineOptions = {
    variables: Record<string, Array<JsonPrimitive|JsonPrimitive[]>>,
};

export class Define implements Action<DefineOptions> {
    public async execute(options: DefineOptions, context: ActionContext): Promise<void> {
        for (const [key, values] of Object.entries(options.variables)) {
            const value = await this.findValue(values, context);

            if (value !== undefined) {
                context.set(key, value);
            }
        }
    }

    private async findValue(
        values: Array<JsonPrimitive|JsonPrimitive[]>,
        context: ActionContext,
    ): Promise<JsonPrimitive|JsonPrimitive[]|undefined> {
        for (const value of values) {
            if (typeof value === 'string') {
                try {
                    return await context.resolve(value);
                } catch {
                    // Ignore
                }
            } else if (Array.isArray(value)) {
                try {
                    return await Promise.all(
                        value.map(item => {
                            if (typeof item === 'string') {
                                return context.resolvePrimitive(item);
                            }

                            return item;
                        }),
                    );
                } catch {
                    // Ignore
                }
            } else {
                return value;
            }
        }

        return undefined;
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'define': DefineOptions;
    }
}
