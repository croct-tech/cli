import {getPackageInfo, isPackageListed} from 'local-pkg';
import {installPackage} from '@antfu/install-pkg';
import {createMatchPathAsync, loadConfig} from 'tsconfig-paths';
import {resolve as resolvePath, relative, join, isAbsolute} from 'path';
import {access, readFile} from 'fs/promises';
import {JavaScriptProject, PackageInfo, PackageInstallationOptions} from '@/application/project/project';

type Configuration = {
    directory: string,
};

export class NodeProject implements JavaScriptProject {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public getRootPath(): string {
        return this.configuration.directory;
    }

    public getProjectPackagePath(): string {
        return join(this.configuration.directory, 'package.json');
    }

    public isTypeScriptProject(): Promise<boolean> {
        return this.isPackageListed('typescript');
    }

    public getTypeScriptConfigPath(): Promise<string | null> {
        const config = loadConfig(this.configuration.directory);

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

        return readFile(join(this.getRootPath(), filePath), 'utf8');
    }

    public async locateFile(...fileNames: string[]): Promise<string | null> {
        const directory = this.getRootPath();

        for (const filename of fileNames) {
            if (isAbsolute(filename)) {
                throw new Error('The file path must be relative');
            }

            const fullPath = join(directory, filename);

            try {
                await access(fullPath);

                return filename;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    continue;
                }

                throw error;
            }
        }

        return null;
    }

    public async isPackageListed(packageName: string): Promise<boolean> {
        try {
            return await isPackageListed(packageName, this.configuration.directory);
        } catch {
            return Promise.resolve(false);
        }
    }

    public async getPackageInfo(packageName: string): Promise<PackageInfo|null> {
        let info: Awaited<ReturnType<typeof getPackageInfo>>;

        try {
            info = await getPackageInfo(packageName, {
                paths: [this.configuration.directory],
            });
        } catch {
            return null;
        }

        if (info === undefined) {
            return null;
        }

        return {
            name: info.name,
            version: info.version ?? null,
            path: info.rootPath,
            metadata: info.packageJson,
        };
    }

    public async installPackage(packageName: string|string[], options: PackageInstallationOptions = {}): Promise<void> {
        await installPackage(packageName, {
            cwd: this.configuration.directory,
            silent: true,
            dev: options.dev,
        });
    }

    public resolveImportPath(importPath: string): Promise<string> {
        const config = loadConfig(this.configuration.directory);

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
                                resolvePath(this.configuration.directory, importPath),
                            ).replace(/\\/g, '/'),
                        );
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    public getImportPath(filePath: string): Promise<string> {
        const config = loadConfig(this.configuration.directory);

        if (config.resultType === 'failed') {
            return Promise.resolve(relative(resolvePath(this.configuration.directory), filePath).replace(/\\/g, '/'));
        }

        const absoluteFilePath = resolvePath(this.configuration.directory, filePath).replace(/\\/g, '/');
        let importPath = relative(config.absoluteBaseUrl, absoluteFilePath).replace(/\\/g, '/');
        let longestMatchLength = 0;

        // Go through each alias and check if it matches the given filePath
        for (const [alias, aliasPaths] of Object.entries(config.paths)) {
            const cleanAlias = alias.replace(/\*$/, ''); // Remove wildcard from alias

            for (const aliasPath of aliasPaths) {
                const cleanAliasPath = aliasPath.replace(/\*$/, ''); // Remove wildcard from alias path
                const aliasBasePath = resolvePath(config.absoluteBaseUrl, cleanAliasPath).replace(/\\/g, '/');

                // Check if the file path starts with the alias base path
                if (absoluteFilePath.startsWith(aliasBasePath)) {
                    const aliasMatchLength = cleanAliasPath.length;

                    if (aliasMatchLength > longestMatchLength) {
                        longestMatchLength = aliasMatchLength;

                        const remainder = absoluteFilePath.slice(aliasBasePath.length).replace(/^\//, '');

                        importPath = cleanAlias + remainder;
                    }
                }
            }
        }

        return Promise.resolve(importPath);
    }
}
