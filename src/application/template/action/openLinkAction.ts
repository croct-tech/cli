import {Action} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type OpenLinkOptions = {
    url: string,
};

export class OpenLinkAction implements Action<OpenLinkOptions> {
    public async execute(options: OpenLinkOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        await output.open(options.url);
    }
}
