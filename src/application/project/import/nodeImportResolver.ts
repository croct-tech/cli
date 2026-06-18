import type {ImportResolver} from '@/application/project/import/importResolver';
import type {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import type {FileSystem} from '@/application/fs/fileSystem';
import type {NodeImportConfig, TsConfigLoader} from '@/application/project/import/tsConfigLoader';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    tsConfigLoader: TsConfigLoader,
};

export class NodeImportResolver implements ImportResolver {
    private static readonly EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs', 'cts', 'cjs'];

    private readonly projectDirectory: WorkingDirectory;

    private readonly fileSystem: FileSystem;

    private readonly tsConfigLoader: TsConfigLoader;

    public constructor({projectDirectory, fileSystem, tsConfigLoader}: Configuration) {
        this.projectDirectory = projectDirectory;
        this.fileSystem = fileSystem;
        this.tsConfigLoader = tsConfigLoader;
    }

    public async getImportPath(filePath: string, sourcePath: string): Promise<string> {
        const projectDirectory = this.projectDirectory.get();
        const absoluteSourcePath = this.fileSystem.isAbsolutePath(sourcePath)
            ? sourcePath
            : this.fileSystem.joinPaths(projectDirectory, sourcePath);

        const absoluteFilePath = this.fileSystem.isAbsolutePath(filePath)
            ? filePath
            : this.fileSystem.joinPaths(projectDirectory, filePath);

        const config = await this.tsConfigLoader.load(projectDirectory, {
            sourcePaths: [absoluteSourcePath],
        });

        const fileImportPath = /\.m(?:js|ts)?$/.test(absoluteFilePath)
            ? absoluteFilePath
            : absoluteFilePath.replace(/\.(ts|js)x?$/, '');

        if (config !== null && this.fileSystem.isSubPath(projectDirectory, fileImportPath)) {
            const resolvedBasePath = this.fileSystem.getRelativePath(projectDirectory, fileImportPath);

            let longestMatchLength = 0;

            let currentPath: string | null = null;

            // Go through each alias and check if it matches the given filePath
            for (const [alias, aliasPaths] of Object.entries(config.paths)) {
                const cleanAlias = this.fileSystem.normalizeSeparators(alias.replace(/\*$/, ''));

                for (const aliasPath of aliasPaths) {
                    const cleanAliasPath = aliasPath.replace(/\*$/, ''); // Remove wildcard from alias path
                    const aliasBasePath = this.fileSystem.getRelativePath(
                        projectDirectory,
                        this.fileSystem.joinPaths(config.baseUrl, cleanAliasPath),
                    );

                    // Check if the file path starts with the alias base path
                    if (resolvedBasePath.startsWith(aliasBasePath)) {
                        const aliasMatchLength = cleanAliasPath.length;

                        if (aliasMatchLength > longestMatchLength) {
                            longestMatchLength = aliasMatchLength;

                            const remainder = resolvedBasePath.slice(aliasBasePath.length)
                                .replace(/^[\\/]+/, '');

                            currentPath = cleanAlias + remainder;
                        }
                    }
                }
            }

            if (currentPath !== null) {
                return Promise.resolve(currentPath.replace(/\\+/g, '/'));
            }
        }

        const resolvedRelativePath = this.fileSystem
            .getRelativePath(
                this.fileSystem.joinPaths(absoluteSourcePath, '..'),
                fileImportPath,
            )
            .replace(/\\/g, '/');

        return Promise.resolve(
            !/^\.\.?\/ ?/.test(resolvedRelativePath)
                ? `./${resolvedRelativePath}`
                : resolvedRelativePath,
        );
    }

    public async resolveImport(importPath: string, sourcePath: string): Promise<string | null> {
        const projectDirectory = this.projectDirectory.get();
        const absoluteSourcePath = this.fileSystem.isAbsolutePath(sourcePath)
            ? sourcePath
            : this.fileSystem.joinPaths(projectDirectory, sourcePath);

        let candidates: string[];

        if (importPath.startsWith('.')) {
            // Relative specifier resolved against the importing file's directory.
            candidates = [this.fileSystem.joinPaths(this.fileSystem.getDirectoryName(absoluteSourcePath), importPath)];
        } else {
            const config = await this.tsConfigLoader.load(projectDirectory, {sourcePaths: [absoluteSourcePath]});

            // A bare specifier (a package, not a project alias) is not resolvable to a project file.
            candidates = config !== null ? this.resolveAliases(config, importPath) : [];
        }

        for (const candidate of candidates) {
            const file = await this.findFile(candidate);

            if (file !== null) {
                return this.fileSystem.getRelativePath(projectDirectory, file);
            }
        }

        return null;
    }

    /**
     * Maps an import specifier to the candidate base paths of every matching tsconfig `paths` alias,
     * most specific (longest literal prefix) first.
     */
    private resolveAliases(config: NodeImportConfig, importPath: string): string[] {
        const specifier = this.fileSystem.normalizeSeparators(importPath);
        const matches: Array<{prefixLength: number, bases: string[]}> = [];

        for (const [pattern, targets] of Object.entries(config.paths)) {
            const wildcard = pattern.indexOf('*');
            let substitution: string | null = null;

            if (wildcard === -1) {
                substitution = specifier === this.fileSystem.normalizeSeparators(pattern) ? '' : null;
            } else {
                const prefix = this.fileSystem.normalizeSeparators(pattern.slice(0, wildcard));
                const suffix = pattern.slice(wildcard + 1);

                if (
                    specifier.startsWith(prefix) && specifier.endsWith(suffix)
                    && specifier.length >= prefix.length + suffix.length
                ) {
                    substitution = specifier.slice(prefix.length, specifier.length - suffix.length);
                }
            }

            if (substitution === null) {
                continue;
            }

            matches.push({
                prefixLength: wildcard === -1 ? pattern.length : wildcard,
                bases: targets.map(
                    target => this.fileSystem.joinPaths(
                        config.baseUrl,
                        target.includes('*') ? target.replace('*', substitution ?? '') : target,
                    ),
                ),
            });
        }

        return matches
            .sort((first, second) => second.prefixLength - first.prefixLength)
            .flatMap(match => match.bases);
    }

    /**
     * Probes a base path for the actual module file, mirroring TypeScript/Node extension and
     * directory-index resolution.
     */
    private async findFile(base: string): Promise<string | null> {
        if (/\.[mc]?[jt]sx?$/.test(base) && await this.fileSystem.exists(base)) {
            return base;
        }

        for (const extension of NodeImportResolver.EXTENSIONS) {
            const file = `${base}.${extension}`;

            if (await this.fileSystem.exists(file)) {
                return file;
            }
        }

        for (const extension of NodeImportResolver.EXTENSIONS) {
            const file = this.fileSystem.joinPaths(base, `index.${extension}`);

            if (await this.fileSystem.exists(file)) {
                return file;
            }
        }

        return null;
    }
}
