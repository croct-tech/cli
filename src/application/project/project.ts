export type PackageInfo = {
    /**
     * The name of the package.
     */
    name: string,

    /**
     * The version of the package.
     *
     * If the version is not available, it is set to null.
     */
    version: string | null,

    /**
     * The path where the package is installed or located.
     */
    path: string,

    /**
     * Additional metadata related to the package.
     */
    metadata: Record<string, any>,
};

export type PackageInstallationOptions = {
    /**
     * If true, the package should be installed as a development dependency.
     */
    dev?: boolean,
};

export interface Project {
    /**
     * Retrieves the root directory of the project.
     *
     * @returns The path to the project's root directory.
     */
    getRootPath(): string;

    /**
     * Returns the path to the project's package file.
     *
     * @returns The path to the project's package file.
     */
    getProjectPackagePath(): string;

    /**
     * Checks if a package is listed in the project's dependencies.
     *
     * @param packageName The name of the package to check.
     * @returns A promise that resolves to true if the package is listed, false otherwise.
     */
    isPackageListed(packageName: string): Promise<boolean>;

    /**
     * Retrieves information about a specific package.
     *
     * This method returns details about the package, such as its name, version, path,
     * and additional metadata. If the package is not found, it returns null.
     *
     * @param packageName The name of the package to get information for.
     * @returns The package information or null if the package is not found.
     */
    getPackageInfo(packageName: string): Promise<PackageInfo | null>;

    /**
     * Installs a package in the project.
     *
     * This method installs the specified package and can be customized to install it
     * as a development dependency using the provided options.
     *
     * @param packageName The name of the packages to install.
     * @param options Optional settings to customize the installation.
     * @returns A promise that resolves once the package installation is complete.
     */
    installPackage(packageName: string|string[], options?: PackageInstallationOptions): Promise<void>;

    /**
     * Reads the first available file from the provided search paths.
     *
     * This method takes multiple file paths and reads the content of the first file it finds.
     * It returns the file content as a string or null if none of the files were found.
     *
     * The search proceeds through the paths in the order they are provided.
     *
     * @param searchPaths The paths to search for the file.
     * @returns The content of the first file found or null if none were found.
     */
    readFile(...searchPaths: string[]): Promise<string | null>;

    /**
     * Locates the first existing file from the provided search paths.
     *
     * This method searches for a file across multiple paths and returns the path
     * of the first found file. If none of the files exist, it returns null.
     *
     * The paths are checked sequentially until a match is found.
     *
     * @param searchPaths The paths to search for the file.
     * @returns The path of the first found file or null if none were found.
     */
    locateFile(...searchPaths: string[]): Promise<string | null>;
}

export interface JavaScriptProject extends Project {
    /**
     * Checks if the project is a TypeScript project.
     *
     * This method uses a best guess approach to determine if the project uses TypeScript.
     *
     * @returns A promise that resolves to true if the project is a TypeScript project, false otherwise.
     */
    isTypeScriptProject(): Promise<boolean>;

    /**
     * Retrieves the path to the TypeScript configuration file.
     *
     * This method attempts to locate the TypeScript configuration file
     * (e.g., tsconfig.json) in the project.
     *
     * @returns The path to the TypeScript configuration file or null if not found.
     */
    getTypeScriptConfigPath(): Promise<string | null>;

    /**
     * Converts a file path to its corresponding import path.
     *
     * This method transforms a local file path into a path that can be used
     * as an import statement in JavaScript or TypeScript code.
     *
     * @param filePath The local file path to convert.
     * @param importPath The path from which the import is made.
     * @returns The corresponding import path.
     */
    getImportPath(filePath: string, importPath?: string): Promise<string>;
}
