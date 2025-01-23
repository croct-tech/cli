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
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: ResolveImportOptions, context: ActionContext): Promise<void> {
        const {importResolver} = this.config;
        const importPath = await importResolver(options.target, options.source);

        const variable = options.output?.importPath;

        if (variable !== undefined) {
            context.set(variable, importPath);
        }
    }
}
