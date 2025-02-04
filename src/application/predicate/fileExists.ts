import {Predicate} from '@/application/predicate/predicate';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    fileSystem: FileSystem,
    files: string[],
};

export class FileExists implements Predicate {
    private readonly fileSystem: FileSystem;

    private readonly files: string[];

    public constructor({fileSystem, files}: Configuration) {
        this.fileSystem = fileSystem;
        this.files = files;
    }

    public async test(): Promise<boolean> {
        const results = await Promise.all(this.files.map(file => this.fileSystem.exists(file)));

        return results.some(result => result);
    }
}
