export type CommandInput = Record<string, any>;

export interface Command<I extends CommandInput> {
    execute(args: I): Promise<void>;
}
