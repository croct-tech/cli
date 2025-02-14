import process from 'node:process';
import {delimiter} from 'path';
import {Readable, Writable} from 'stream';
import {Process, ProcessEvents} from '@/application/system/process/process';
import {EventDispatcher, EventListener} from '@/application/event';

export class NodeProcess implements Process {
    private readonly eventDispatcher = new EventDispatcher<ProcessEvents>();

    public constructor() {
        process.on('SIGTERM', () => this.exit());
        process.on('SIGINT', () => this.exit());
    }

    public getCurrentDirectory(): string {
        return process.cwd();
    }

    public getEnvValue(name: string): string | null {
        return process.env[name] ?? null;
    }

    public getEnvList(name: string): string[] | null {
        return this.getEnvValue(name)?.split(delimiter) ?? null;
    }

    public getPlatform(): string {
        return process.platform;
    }

    public getStandardError(): Writable {
        return process.stderr;
    }

    public getStandardInput(): Readable {
        return process.stdin;
    }

    public getStandardOutput(): Writable {
        return process.stdout;
    }

    public on<E extends keyof ProcessEvents>(event: E, listener: EventListener<ProcessEvents[E]>): void {
        this.eventDispatcher.on(event, listener);
    }

    public off<E extends keyof ProcessEvents>(event: E, listener: EventListener<ProcessEvents[E]>): void {
        this.eventDispatcher.off(event, listener);
    }

    public async exit(exitCode?: number): Promise<never> {
        await this.eventDispatcher
            .emit('exit')
            .catch(() => {});

        return process.exit(exitCode);
    }

    public changeDirectory(directory: string): void {
        process.chdir(directory);
    }
}
