import {CurrentWorkingDirectory} from "@/application/fs/workingDirectory/workingDirectory";

export class VirtualizedWorkingDirectory implements CurrentWorkingDirectory {
    private currentDirectory: string;

    public constructor(currentDirectory: string) {
        this.currentDirectory = currentDirectory;
    }

    public get(): string {
        return this.currentDirectory;
    }

    public setCurrentDirectory(directory: string): void {
        this.currentDirectory = directory;
    }

    public toString(): string {
        return this.get();
    }
}
