import {Minimatch} from 'minimatch';
import {Codemod, CodemodError, ResultCode} from '@/application/project/code/transformation/codemod';
import {ImportResolver} from '@/application/project/import/importResolver';
import {FileSystem} from '@/application/fs/fileSystem';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {Predicate} from '@/application/predicate/predicate';
import {ErrorReason} from '@/application/error';

export type ImportDeclaration = {
    names: string[],
    source: string,
};

export type ExportMatcher = Predicate<[string, ImportDeclaration]>;

export type ImportTransformer = (declaration: ImportDeclaration) => Promise<string | void> | string | void;

export type ImportCodemodOptions = {
    transformer: ImportTransformer,
};

export interface ImportCodemod extends Codemod<string, ImportCodemodOptions> {
}

export type Configuration = {
    rootPath: WorkingDirectory,
    importCodemod: ImportCodemod,
    importResolver: ImportResolver,
    exportMatcher: ExportMatcher,
    fileSystem: FileSystem,
    maxSearchDepth: number,
};

export class GlobImportCodemod implements Codemod<string> {
    private static readonly PREFIX = '?/';

    private readonly rootPath: WorkingDirectory;

    private readonly importResolver: ImportResolver;

    private readonly exportMatcher: ExportMatcher;

    private readonly importCodemod: ImportCodemod;

    private readonly fileSystem: FileSystem;

    private readonly maxSearchDepth: number;

    public constructor(configuration: Configuration) {
        this.rootPath = configuration.rootPath;
        this.importResolver = configuration.importResolver;
        this.exportMatcher = configuration.exportMatcher;
        this.importCodemod = configuration.importCodemod;
        this.fileSystem = configuration.fileSystem;
        this.maxSearchDepth = configuration.maxSearchDepth;
    }

    public apply(path: string): Promise<ResultCode<string>> {
        return this.importCodemod.apply(path, {
            transformer: declaration => {
                if (!declaration.source.startsWith(GlobImportCodemod.PREFIX)) {
                    return;
                }

                const pattern = declaration.source.slice(GlobImportCodemod.PREFIX.length);

                return this.resolvePath(declaration, pattern, path);
            },
        });
    }

    private async resolvePath(declaration: ImportDeclaration, pattern: string, sourcePath: string): Promise<string> {
        const matcher = new Minimatch(pattern);
        const rootPath = this.rootPath.get();

        for await (const file of this.fileSystem.list(rootPath, this.maxSearchDepth)) {
            if (
                file.type === 'file'
                && matcher.match(file.name)
                && await this.exportMatcher.test(await new Response(file.content).text(), declaration)
            ) {
                return this.importResolver.getImportPath(this.fileSystem.joinPaths(rootPath, file.name), sourcePath);
            }
        }

        throw new CodemodError(`Unable to resolve import \`${pattern}\` from \`${sourcePath}\`.`, {
            reason: ErrorReason.NOT_FOUND,
        });
    }
}
