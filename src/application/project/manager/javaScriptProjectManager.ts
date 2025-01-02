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
}
