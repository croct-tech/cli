import {ProjectManager} from '@/application/project/manager/projectManager';

/**
 * Represents a terminal command.
 */
export type Command = {
    /**
     * The name of the command.
     */
    name: string,

    /**
     * The arguments to pass to the command.
     */
    args: string[],
};

export interface JavaScriptProjectManager extends ProjectManager {
    /**
     * Returns the command to run a script.
     *
     * @param script The name of the script.
     * @param args The arguments to pass to the script.
     *
     * @returns The command to run the script.
     */
   getScriptCommand(script: string, args?: string[]): Promise<Command>;

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
