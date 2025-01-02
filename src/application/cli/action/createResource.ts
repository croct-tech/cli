import {Action} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';

export type CreateResourceOptions = {
    components: string|string[],
};

export type Configuration = {
};

export class CreateResource implements Action<CreateResourceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: CreateResourceOptions, context: ActionContext): Promise<void> {
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'create-resource': CreateResourceOptions;
    }
}
