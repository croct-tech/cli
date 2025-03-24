import {Provider} from '@/application/provider/provider';

export interface WorkingDirectory extends Provider<string>{
    get(): string;
    toString(): string;
}

export interface CurrentWorkingDirectory extends WorkingDirectory {
    setCurrentDirectory(directory: string): void;
}
