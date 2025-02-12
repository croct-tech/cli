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
    arguments?: string[],
};
