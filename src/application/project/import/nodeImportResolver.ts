import {ImportResolver} from '@/application/project/import/importResolver';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
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
}
