import {Action, ActionError} from '@/application/template/action/action';

export type AddDependencyOptions = {
    dependencies: string[],
    development?: boolean,
};

export type DependencyInstaller = (dependencies: string[], development: boolean) => Promise<void>;

export type Configuration = {
    installer: DependencyInstaller,
};

export class AddDependencyAction implements Action<AddDependencyOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: AddDependencyOptions): Promise<void> {
        const {installer} = this.config;

        try {
            await installer(options.dependencies, options.development === true);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
