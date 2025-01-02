import {Action, ActionError} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';

export type AddDependencyOptions = {
    dependencies: string|string[],
    development?: boolean|string,
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
        const [dependencies, development] = await Promise.all([
            typeof options.dependencies === 'string'
                ? context.resolveStringList(options.dependencies)
                : Promise.all(options.dependencies.map(dependency => context.resolveString(dependency))),
            typeof options.development === 'string'
                ? context.resolveBoolean(options.development)
                : options.development === true,
        ]);

        try {
            await installer(dependencies, development);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'add-dependency': AddDependencyOptions;
    }
}
