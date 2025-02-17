import {CurrentWorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {Process} from '@/application/system/process/process';

export class ProcessWorkingDirectory implements CurrentWorkingDirectory {
    private readonly process: Process;

    public constructor(process: Process) {
        this.process = process;
    }

    public get(): string {
        return this.process.getCurrentDirectory();
    }

    public setCurrentDirectory(directory: string): void {
        this.process.changeDirectory(directory);
    }

    public toString(): string {
        return this.get();
    }
}
