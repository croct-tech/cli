import {JsonValue} from '@croct/json';
import {Action} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type DefineOptions = {
    variables: Record<string, JsonValue>,
};

export class DefineAction implements Action<DefineOptions> {
    public execute(options: DefineOptions, context: ActionContext): Promise<void> {
        for (const [name, value] of Object.entries(options.variables)) {
            context.set(name, value);
        }

        return Promise.resolve();
    }
}
