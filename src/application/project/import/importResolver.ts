import type {Help} from '@/application/error';
import {HelpfulError} from '@/application/error';

export class ImportResolverError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, ImportResolverError.prototype);
    }
}

export interface ImportResolver {
    /**
     * Returns the import specifier to use for `filePath` from `importPath` (file → specifier).
     */
    getImportPath(filePath: string, importPath?: string): Promise<string>;

    /**
     * Resolves an import specifier from `sourcePath` to the file it points to, or null (specifier → file).
     */
    resolveImport(importPath: string, sourcePath: string): Promise<string | null>;
}
