export type PackageInfo = {
    name: string,
    version: string | null,
    path: string,
    metadata: Record<string, any>,
};

export type PackageInstallationOptions = {
    dev?: boolean,
};

export interface ProjectManager {
    getDirectory(): string;

    isPackageListed(packageName: string): Promise<boolean>;

    getPackageInfo(packageName: string): Promise<PackageInfo|null>;

    installPackage(packageName: string, options?: PackageInstallationOptions): Promise<void>;

    getImportPath(filePath: string): Promise<string>;

    resolveImportPath(importPath: string): Promise<string>;
}
