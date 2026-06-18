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
     * Resolves an import specifier written in `sourcePath` to the project-relative file path it
     * points to (specifier → file), the inverse of {@link getImportPath}.
     *
     * Honors the project's tsconfig `paths`/`baseUrl` aliases and relative specifiers, then probes
     * extensions (`.ts`, `.tsx`, `.js`, `.jsx`, and `index.*`) the way the TypeScript/Node resolver
     * does. Returns null for bare packages or when no matching file exists.
     */
    resolveImport(importPath: string, sourcePath: string): Promise<string | null>;
}
