import {Action} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type ResolveImportOptions = {
    target: string,
    source: string,
    output?: {
        importPath?: string,
    },
};

export type Configuration = {
    importResolver: ImportResolver,
};

export type ImportResolver = (target: string, source: string) => Promise<string>;

export class ResolveImportAction implements Action<ResolveImportOptions> {
    private readonly resolver: ImportResolver;

    public constructor({importResolver}: Configuration) {
        this.resolver = importResolver;
    }

    public async execute(options: ResolveImportOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Resolving import');

        try {
            await this.resolveImport(options, context);
        } finally {
            notifier?.stop();
        }
    }

    private async resolveImport(options: ResolveImportOptions, context: ActionContext): Promise<void> {
        const importPath = await this.resolver(options.target, options.source);

        const variable = options.output?.importPath;

        if (variable !== undefined) {
            context.set(variable, importPath);
        }
    }
}
