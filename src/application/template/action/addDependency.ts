import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type AddDependencyOptions = {
    dependencies: string[],
    development?: boolean,
};

export type DependencyInstaller = (dependencies: string[], development: boolean) => Promise<void>;

export type Configuration = {
    installer: DependencyInstaller,
};

export class AddDependency implements Action<AddDependencyOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: AddDependencyOptions, context: ActionContext): Promise<void> {
        const {installer} = this.config;
        const dependencies = await (typeof options.dependencies === 'string'
            ? context.resolveStringList(options.dependencies)
            : Promise.all(options.dependencies.map(dependency => context.resolveString(dependency))));

        try {
            await installer(dependencies, options.development === true);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}

declare module '@/application/template/action/action' {
    export interface ActionOptionsMap {
        'add-dependency': AddDependencyOptions;
    }
}
