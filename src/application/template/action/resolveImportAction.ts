import {Action} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ImportResolver} from '@/application/project/import/importResolver';

export type ResolveImportOptions = {
    target: string,
    source: string,
    result?: {
        importPath?: string,
    },
};

export type Configuration = {
    importResolver: ImportResolver,
};

export class ResolveImportAction implements Action<ResolveImportOptions> {
    private readonly importResolver: ImportResolver;

    public constructor({importResolver}: Configuration) {
        this.importResolver = importResolver;
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
        const importPath = await this.importResolver.getImportPath(options.target, options.source);

        const variable = options.result?.importPath;

        if (variable !== undefined) {
            context.set(variable, importPath);
        }
    }
}
