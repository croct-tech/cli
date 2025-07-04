import {Logger} from '@croct/logging';
import {Help, HelpfulError} from '@/application/error';
import {Command} from '@/application/system/process/command';
import {ExecutionOptions} from '@/application/system/process/executor';

export class PackageManagerError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, PackageManagerError.prototype);
    }
}

export type Dependency = {
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
    directory: string,

    /**
     * Additional metadata related to the package.
     */
    metadata: Record<string, any>,
};

export type CommandOptions = Omit<ExecutionOptions, 'workingDirectory'>;

export type ActionOptions = {
    logger?: Logger,
};

export type InstallDependenciesOptions = ActionOptions & {
    logger?: Logger,
};

export type AddDependencyOptions = ActionOptions & {
    dev?: boolean,
};

export type UpdatePackageOptions = ActionOptions & {
    global?: boolean,
};

export type UpdateCommandOptions = {
    global?: boolean,
};

export interface PackageManager {
    /**
     * Returns the package manager name.
     */
    getName(): Promise<string>;

    /**
     * Checks if the package manager is installed on the system.
     *
     * @returns A promise that resolves to true if the package manager is installed, false otherwise.
     */
    isInstalled(): Promise<boolean>;

    /**
     * Checks if the current directory is a project.
     */
    isProject(): Promise<boolean>;

    /**
     * Checks if a package is listed in the project's dependencies.
     *
     * @param packageName The name of the package to check.
     * @param version The version of the package to check.
     * @returns A promise that resolves to true if the package is listed, false otherwise.
     *
     * @throws PackageManagerError If an error occurs while checking the package,
     * like if the manifest file is not found or invalid.
     */
    hasDirectDependency(packageName: string, version?: string): Promise<boolean>;

    /**
     * Checks if a package is installed.
     *
     * An installed package is not necessarily listed as dependency, as it might be
     * an indirect dependency.
     *
     * @param packageName The name of the package to check.
     * @param version The version of the package to check.
     * @returns A promise that resolves to true if the package is installed, false otherwise.
     *
     * @throws PackageManagerError If an error occurs while checking the package,
     * like if the manifest file is not found or invalid.
     */
    hasDependency(packageName: string, version?: string): Promise<boolean>;

    /**
     * Retrieves information about a specific dependency, direct or indirect.
     *
     * This method returns details about the package, such as its name, version, path,
     * and additional metadata. If the package is not found, or the manifest file
     * cannot be read, the method returns null.
     *
     * @param name The name of the package to get information for.
     * @returns The package information or null if the package is not found.
     */
    getDependency(name: string): Promise<Dependency | null>;

    /**
     * Installs a package in the project.
     *
     * This method adds the specified package to the project's dependencies and installs it.
     *
     * @param dependencies The name of the packages to install.
     * @param options Additional options for adding the dependencies.
     * @returns A promise that resolves once the package installation is complete.
     *
     * @throws PackageManagerError If an error occurs while installing the package.
     */
    addDependencies(dependencies: string[], options?: AddDependencyOptions): Promise<void>;

    /**
     * Installs the project dependencies.
     *
     * This method installs all the dependencies listed in the project's manifest file.
     *
     * @param options Additional options for installing the dependencies.

     * @returns A promise that resolves once the dependencies are installed.
     *
     * @throws PackageManagerError If an error occurs while installing the dependencies.
     */
    installDependencies(options?: InstallDependenciesOptions): Promise<void>;

    /**
     * Updates a specific local or global package.
     *
     * @param packageName The name of the package to update.
     * @param options Additional options for updating the package.
     */
    updatePackage(packageName: string, options?: UpdatePackageOptions): Promise<void>;

    /**
     * Retrieves the scripts defined in the project.
     *
     * @returns A promise that resolves with the list of scripts defined in the project.
     */
    getScripts(): Promise<Record<string, string>>;

    /**
     * Adds a script to the project.
     *
     * This method registers a new script in the project.
     *
     * @param name The name of the script to add.
     * @param command The command to execute when running the script.
     *
     * @returns A promise that resolves once the script is added.
     */
    addScript(name: string, command: string): Promise<void>;

    /**
     * Runs a script in the project.
     *
     * @param script The name of the script to run.
     * @param args Additional arguments to pass to the script.
     *
     * @returns A promise that resolves to the command to run the script.
     */
    getScriptCommand(script: string, args?: string[]): Promise<Command>;

    /**
     * Returns the command to run a package.
     *
     * @param packageName The name of the package to run.
     * @param args Additional arguments to pass to the package.
     *
     * @returns A promise that resolves to the command to run the package.
     */
    getPackageCommand(packageName: string, args?: string[]): Promise<Command>;

    /**
     * Returns the command to update a package.
     *
     * @param packageName The name of the package to update.
     * @param options Additional options for updating the package.
     */
    getPackageUpdateCommand(packageName: string, options?: UpdateCommandOptions): Promise<Command>;
}
