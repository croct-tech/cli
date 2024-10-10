export type CommandInput = Record<string, any>;

export interface Command<I extends CommandInput, O> {
    execute(args: I): Promise<O>|O;
}
