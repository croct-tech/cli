import {Help, HelpfulError} from '@/application/error';

export class ImportResolverError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, ImportResolverError.prototype);
    }
}

export interface ImportResolver {
    getImportPath(filePath: string, importPath?: string): Promise<string>;
}
