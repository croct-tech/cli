export type PackageInfo = {
    name: string,
    version: string | null,
    path: string,
};

export type PackageManageInfo = {
    name: string,
    version: string | null,
};

export type PackageInstallationOptions = {
    dev?: boolean,
};

export interface PackageManager {
    getDirectory(): string;

    getPackageManagerInfo(): Promise<PackageManageInfo|null>;

    isPackageListed(packageName: string): Promise<boolean>;

    getPackageInfo(packageName: string): Promise<PackageInfo|null>;

    installPackage(packageName: string, options?: PackageInstallationOptions): Promise<void>;

    resolveImportPath(importPath: string): Promise<string>;
}
