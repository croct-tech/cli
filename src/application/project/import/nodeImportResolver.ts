import {ImportResolver} from '@/application/project/import/importResolver';
import {WorkingDirectory} from '@/application/fs/workingDirectory';
import {FileSystem} from '@/application/fs/fileSystem';
import {TsConfigLoader} from '@/application/project/import/tsConfigLoader';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    tsConfigLoader: TsConfigLoader,
};

export class NodeImportResolver implements ImportResolver {
    private readonly projectDirectory: WorkingDirectory;

    private readonly fileSystem: FileSystem;

    private readonly tsConfigLoader: TsConfigLoader;

    public constructor({projectDirectory, fileSystem, tsConfigLoader}: Configuration) {
        this.projectDirectory = projectDirectory;
        this.fileSystem = fileSystem;
        this.tsConfigLoader = tsConfigLoader;
    }

    public async getImportPath(filePath: string, importPath?: string): Promise<string> {
        const workingDirectory = this.projectDirectory.get();
        const config = await this.tsConfigLoader.load(workingDirectory, {
            sourcePaths: importPath === undefined
                ? [workingDirectory]
                : [this.fileSystem.joinPaths(workingDirectory, importPath)],
        });

        const fileImportPath = importPath !== undefined && /\.m(?:js|ts)?$/.test(filePath)
            ? filePath
            : filePath.replace(/\.(ts|js)x?$/, '');

        const resolvedBasePath = this.fileSystem.joinPaths(workingDirectory, fileImportPath);

        if (config !== null) {
            let longestMatchLength = 0;

            let currentPath: string | null = null;

            // Go through each alias and check if it matches the given filePath
            for (const [alias, aliasPaths] of Object.entries(config.paths)) {
                const cleanAlias = this.fileSystem.normalizeSeparators(alias.replace(/\*$/, ''));

                for (const aliasPath of aliasPaths) {
                    const cleanAliasPath = aliasPath.replace(/\*$/, ''); // Remove wildcard from alias path
                    const aliasBasePath = this.fileSystem.joinPaths(config.baseUrl, cleanAliasPath);

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

        const resolvedFilePath = this.fileSystem.joinPaths(resolvedBasePath, fileImportPath);
        const resolvedRelativePath = importPath === undefined
            ? this.fileSystem.getRelativePath(workingDirectory, resolvedFilePath)
            : this.fileSystem.getRelativePath(
                this.fileSystem.joinPaths(resolvedBasePath, importPath),
                resolvedFilePath,
            );

        return Promise.resolve(resolvedRelativePath.replace(/\\/g, '/'));
    }
}
