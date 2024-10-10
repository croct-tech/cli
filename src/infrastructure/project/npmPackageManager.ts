import {detect} from 'package-manager-detector/detect';
import {getPackageInfo, isPackageListed} from 'local-pkg';
import {installPackage} from '@antfu/install-pkg';
import {createMatchPathAsync, loadConfig} from 'tsconfig-paths';
import {
    PackageInfo,
    PackageInstallationOptions,
    PackageManageInfo,
    PackageManager,
} from '@/application/project/packageManager';

type Configuration = {
    directory: string,
};

export class NpmPackageManager implements PackageManager {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public getDirectory(): string {
        return this.configuration.directory;
    }

    public async getPackageManagerInfo(): Promise<PackageManageInfo | null> {
        const result = await detect({
            cwd: this.configuration.directory,
        });

        if (result === null) {
            return null;
        }

        return {
            name: result.name,
            version: result.version ?? null,
        };
    }

    public isPackageListed(packageName: string): Promise<boolean> {
        return isPackageListed(packageName, this.configuration.directory);
    }

    public async getPackageInfo(packageName: string): Promise<PackageInfo|null> {
        const info = await getPackageInfo(packageName, {
            paths: [this.configuration.directory],
        });

        if (info === undefined) {
            return null;
        }

        return {
            name: info.name,
            version: info.version ?? null,
            path: info.rootPath,
        };
    }

    public async installPackage(packageId: string, options: PackageInstallationOptions = {}): Promise<void> {
        await installPackage(packageId, {
            cwd: this.configuration.directory,
            silent: true,
            dev: options.dev,
        });
    }

    public resolveImportPath(importPath: string): Promise<string> {
        const config = loadConfig(this.configuration.directory);

        if (config.resultType === 'failed') {
            throw new Error(
                `Unable to find a tsconfig.json or jsconfig.json file. ${config.message ?? ''}`.trim(),
            );
        }

        return new Promise((resolve, reject) => {
            createMatchPathAsync(config.absoluteBaseUrl, config.paths)(
                importPath,
                undefined,
                () => true,
                ['.ts', '.tsx', '.js', '.jsx'],
                (error, path) => {
                    if (error !== undefined || path === undefined) {
                        reject(error ?? new Error('Unable to resolve import path.'));
                    } else {
                        resolve(path);
                    }
                },
            );
        });
    }
}
