import {Provider} from '@/application/provider/provider';

export interface WorkingDirectory extends Provider<string>{
    get(): string;
    toString(): string;
}

export interface CurrentWorkingDirectory extends WorkingDirectory {
    setCurrentDirectory(directory: string): void;
}

export class ConfigurableWorkingDirectory implements CurrentWorkingDirectory {
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
