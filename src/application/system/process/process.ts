import {Readable, Writable} from 'stream';
import {EventObserver} from '@/application/event';

export type ProcessEvents = {
    exit: [],
};

export interface ProcessObserver extends EventObserver<ProcessEvents> {
}

export interface Process extends ProcessObserver {
    getPlatform(): string;
    getCurrentDirectory(): string;
    getStandardInput(): Readable;
    getStandardOutput(): Writable;
    getStandardError(): Writable;
    getEnvValue(name: string): string | undefined;
    getEnvList(name: string): string[] | undefined;
    changeDirectory(directory: string): void;
    exit(exitCode?: number): Promise<never>;
}
