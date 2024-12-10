import {getPackageInfo, isPackageListed} from 'local-pkg';
import {installPackage} from '@antfu/install-pkg';
import {createMatchPathAsync, loadConfig} from 'tsconfig-paths';
import {relative, join, isAbsolute} from 'path';
import {JavaScriptProject, PackageInfo, PackageInstallationOptions} from '@/application/project/project';
import {Filesystem} from '@/application/filesystem';

export type Configuration = {
    directory: string,
    filesystem: Filesystem,
};

export class NodeProject implements JavaScriptProject {
    private readonly filesystem: Filesystem;

    private readonly directory: string;

    public constructor({directory, filesystem}: Configuration) {
        this.filesystem = filesystem;
        this.directory = directory;
    }

    public getRootPath(): string {
        return this.directory;
    }

    public getProjectPackagePath(): string {
        return join(this.directory, 'package.json');
    }

    public isTypeScriptProject(): Promise<boolean> {
        return this.isPackageListed('typescript');
    }

    public getTypeScriptConfigPath(): Promise<string | null> {
        const config = loadConfig(this.directory);

        if (config.resultType === 'failed') {
            return Promise.resolve(null);
        }

        return Promise.resolve(config.configFileAbsolutePath);
    }

    public async readFile(...fileNames: string[]): Promise<string | null> {
        const filePath = await this.locateFile(...fileNames);

        if (filePath === null) {
            return null;
        }

        return this.filesystem.readFile(join(this.getRootPath(), filePath));
    }

    public async locateFile(...fileNames: string[]): Promise<string | null> {
        const directory = this.getRootPath();

        for (const filename of fileNames) {
            if (isAbsolute(filename)) {
                throw new Error('The file path must be relative');
            }

            const fullPath = join(directory, filename);

            if (await this.filesystem.exists(fullPath)) {
                return filename;
            }
        }

        return null;
    }

    public async isPackageListed(packageName: string): Promise<boolean> {
        try {
            return await isPackageListed(packageName, this.directory);
        } catch {
            return Promise.resolve(false);
        }
    }

    public async getPackageInfo(packageName: string): Promise<PackageInfo|null> {
        let info: Awaited<ReturnType<typeof getPackageInfo>>;

        try {
            info = await getPackageInfo(packageName, {
                paths: [this.directory],
            });
        } catch {
            return null;
        }

        if (info === undefined) {
            return null;
        }

        let packagePath = info.rootPath;

        try {
            // Package info does not preserve symlinks
            const path = join(this.directory, 'node_modules', packageName);

            if (await this.filesystem.isSymbolicLink(path)) {
                packagePath = path;
            }
        } catch {
            // Ignore errors
        }

        return {
            name: info.name,
            version: info.version ?? null,
            path: packagePath,
            metadata: info.packageJson,
        };
    }

    public async installPackage(packageName: string|string[], options: PackageInstallationOptions = {}): Promise<void> {
        await installPackage(packageName, {
            cwd: this.directory,
            silent: true,
            dev: options.dev,
        });
    }

    public resolveImportPath(importPath: string): Promise<string> {
        const config = loadConfig(this.directory);

        if (config.resultType === 'failed') {
            return Promise.resolve(importPath);
        }

        return new Promise((resolve, reject) => {
            const matchPath = createMatchPathAsync(config.absoluteBaseUrl, config.paths);

            try {
                matchPath(importPath, undefined, () => true, ['.ts', '.tsx', '.js', '.jsx'], (error, path) => {
                    if (error !== undefined) {
                        reject(error);
                    } else {
                        resolve(
                            path
                            ?? relative(
                                config.absoluteBaseUrl,
                                join(this.directory, importPath),
                            ).replace(/\\/g, '/'),
                        );
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    public getImportPath(filePath: string, importPath?: string): Promise<string> {
        const config = loadConfig(this.directory);
        const resolvedBasePath = join(this.directory, filePath);

        if (config.resultType !== 'failed') {
            const absoluteFilePath = resolvedBasePath.replace(/\\/g, '/');
            let longestMatchLength = 0;

            let currentPath: string | null = null;

            // Go through each alias and check if it matches the given filePath
            for (const [alias, aliasPaths] of Object.entries(config.paths)) {
                const cleanAlias = alias.replace(/\*$/, ''); // Remove wildcard from alias

                for (const aliasPath of aliasPaths) {
                    const cleanAliasPath = aliasPath.replace(/\*$/, ''); // Remove wildcard from alias path
                    const aliasBasePath = join(config.absoluteBaseUrl, cleanAliasPath)
                        .replace(/\\/g, '/');

                    // Check if the file path starts with the alias base path
                    if (absoluteFilePath.startsWith(aliasBasePath)) {
                        const aliasMatchLength = cleanAliasPath.length;

                        if (aliasMatchLength > longestMatchLength) {
                            longestMatchLength = aliasMatchLength;

                            const remainder = absoluteFilePath.slice(aliasBasePath.length).replace(/^\//, '');

                            currentPath = cleanAlias + remainder;
                        }
                    }
                }
            }

            if (currentPath !== null) {
                return Promise.resolve(currentPath);
            }
        }

        const resolvedFilePath = join(resolvedBasePath, filePath);
        const resolvedRelativePath = importPath === undefined
            ? relative(this.directory, resolvedFilePath)
            : relative(join(resolvedBasePath, importPath), resolvedFilePath);

        return Promise.resolve(resolvedRelativePath.replace(/\\/g, '/'));
    }
}
