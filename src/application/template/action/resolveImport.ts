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

export class ResolveImportFile implements Action<ResolveImportOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: ResolveImportOptions, context: ActionContext): Promise<void> {
        const {importResolver} = this.config;

        const [target, source] = await Promise.all([
            context.resolveString(options.target),
            context.resolveString(options.source),
        ]);

        const importPath = await importResolver(target, source);

        const variable = options.output?.importPath;

        if (variable !== undefined) {
            context.set(variable, await context.resolveValue(importPath));
        }
    }
}

declare module '@/application/template/action/action' {
    export interface ActionOptionsMap {
        'resolve-import': ResolveImportOptions;
    }
}
