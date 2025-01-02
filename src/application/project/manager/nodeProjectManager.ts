import {z} from 'zod';
import {PackageInfo, PackageInstallationOptions} from '@/application/project/manager/projectManager';
import {FileSystem} from '@/application/fileSystem/fileSystem';
import {ImportConfigLoader} from '@/application/project/manager/importConfigLoader';
import {JavaScriptProjectManager} from '@/application/project/manager/javaScriptProjectManager';

export type Configuration = {
    directory: string,
    fileSystem: FileSystem,
    packageInstaller: NodePackageInstaller,
    importConfigLoader: ImportConfigLoader,
};

const packageSchema = z.object({
    name: z.string(),
    version: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    bin: z.record(z.string()).optional(),
});

export type NodePackageInstaller = Pick<JavaScriptProjectManager, 'installPackage'>;

export class NodeProjectManager implements JavaScriptProjectManager {
    private readonly fileSystem: FileSystem;

    private readonly packageInstaller: NodePackageInstaller;

    private readonly importConfigLoader: ImportConfigLoader;

    private readonly directory: string;

    public constructor({directory, fileSystem, importConfigLoader, packageInstaller}: Configuration) {
        this.fileSystem = fileSystem;
        this.directory = directory;
        this.packageInstaller = packageInstaller;
        this.importConfigLoader = importConfigLoader;
    }

    public getRootPath(): string {
        return this.directory;
    }

    public getProjectPackagePath(): string {
        return this.fileSystem.joinPaths(this.directory, 'package.json');
    }

    public isTypeScriptProject(): Promise<boolean> {
        return this.isPackageListed('typescript');
    }

    public async getTypeScriptConfigPath(sourcePaths = []): Promise<string | null> {
        const config = await this.importConfigLoader.load(this.directory, {
            fileNames: ['tsconfig.json'],
            sourcePaths: sourcePaths.length === 0 ? [this.directory] : sourcePaths,
        });

        if (config === null) {
            return null;
        }

        return config.matchedConfigPath;
    }

    public async readFile(...fileNames: string[]): Promise<string | null> {
        const filePath = await this.locateFile(...fileNames);

        if (filePath === null) {
            return null;
        }

        return this.fileSystem.readFile(this.fileSystem.joinPaths(this.getRootPath(), filePath));
    }

    public async locateFile(...fileNames: string[]): Promise<string | null> {
        const directory = this.getRootPath();

        for (const filename of fileNames) {
            if (this.fileSystem.isAbsolutePath(filename)) {
                throw new Error('The file path must be relative');
            }

            const fullPath = this.fileSystem.joinPaths(directory, filename);

            if (await this.fileSystem.exists(fullPath)) {
                return filename;
            }
        }

        return null;
    }

    public async isPackageListed(packageName: string): Promise<boolean> {
        const info = await this.getPackageJson(this.getProjectPackagePath());

        if (info === null) {
            return false;
        }

        return (info.dependencies !== undefined && packageName in info.dependencies)
            || (info.devDependencies !== undefined && packageName in info.devDependencies);
    }

    public async getPackageInfo(packageName: string): Promise<PackageInfo|null> {
        const directory = this.fileSystem.joinPaths(this.directory, 'node_modules', packageName);
        const info = await this.getPackageJson(this.fileSystem.joinPaths(directory, 'package.json'));

        if (info === null) {
            return null;
        }

        return {
            name: info.name,
            version: info.version ?? null,
            directory: directory,
            metadata: info,
        };
    }

    private async getPackageJson(path: string): Promise<z.infer<typeof packageSchema> | null> {
        if (!await this.fileSystem.exists(path)) {
            return null;
        }

        try {
            return packageSchema.parse(JSON.parse(await this.fileSystem.readFile(path)));
        } catch {
            return null;
        }
    }

    public async installPackage(packageName: string|string[], options: PackageInstallationOptions = {}): Promise<void> {
        await this.packageInstaller.installPackage(packageName, options);
    }

    public async getImportPath(filePath: string, importPath?: string): Promise<string> {
        const config = await this.importConfigLoader.load(this.directory, {
            fileNames: ['tsconfig.json', 'jsconfig.json'],
            sourcePaths: importPath === undefined
                ? [this.directory]
                : [this.fileSystem.joinPaths(this.directory, importPath)],
        });

        const fileImportPath = importPath !== undefined && /\.m(?:js|ts)?$/.test(filePath)
            ? filePath
            : filePath.replace(/\.(ts|js)x?$/, '');

        const resolvedBasePath = this.fileSystem.joinPaths(this.directory, fileImportPath);

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
            ? this.fileSystem.getRelativePath(this.directory, resolvedFilePath)
            : this.fileSystem.getRelativePath(
                this.fileSystem.joinPaths(resolvedBasePath, importPath),
                resolvedFilePath,
            );

        return Promise.resolve(resolvedRelativePath.replace(/\\/g, '/'));
    }
}
