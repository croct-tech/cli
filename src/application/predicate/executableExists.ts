import {Predicate} from '@/application/predicate/predicate';
import {ExecutableLocator} from '@/application/system/executableLocator';

export type Configuration = {
    executableLocator: ExecutableLocator,
    command: string,
};

export class ExecutableExists implements Predicate {
    private readonly executableLocator: ExecutableLocator;

    private readonly command: string;

    public constructor({executableLocator, command}: Configuration) {
        this.executableLocator = executableLocator;
        this.command = command;
    }

    public async test(): Promise<boolean> {
        return (await this.executableLocator.locate(this.command)) !== null;
    }
}
