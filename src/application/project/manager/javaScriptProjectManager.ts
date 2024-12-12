import {ProjectManager} from '@/application/project/manager/projectManager';

export interface JavaScriptProjectManager extends ProjectManager {
    /**
     * Checks if the project is a TypeScript project.
     *
     * This method uses the best guess approach to determine if the project uses TypeScript.
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
     * @param sourcePaths The path of the source directories affected by the configuration.
     * @returns The path to the TypeScript configuration file or null if not found.
     */
    getTypeScriptConfigPath(sourcePaths?: string[]): Promise<string | null>;

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
