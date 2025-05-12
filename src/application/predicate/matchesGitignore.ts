import {Predicate} from '@/application/predicate/predicate';
import {MatchesGlob} from '@/application/predicate/matchesGlob';
import {FileSystem} from '@/application/fs/fileSystem';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';

export type Configuration = {
    fileSystem: FileSystem,
    workingDirectory: WorkingDirectory,
};

export class MatchesGitignore implements Predicate<[string]> {
    private readonly fileSystem: FileSystem;

    private readonly workingDirectory: WorkingDirectory;

    private readonly cache: Map<string, MatchesGlob|null> = new Map();

    public constructor({fileSystem, workingDirectory}: Configuration) {
        this.fileSystem = fileSystem;
        this.workingDirectory = workingDirectory;
    }

    public async test(path: string): Promise<boolean> {
        return (await this.getPredicate())?.test(path) ?? false;
    }

    private async getPredicate(): Promise<MatchesGlob|null> {
        const gitignorePath = this.fileSystem.joinPaths(this.workingDirectory.get(), '.gitignore');

        if (this.cache.has(gitignorePath)) {
            return this.cache.get(gitignorePath)!;
        }

        let predicate: MatchesGlob|null = null;

        if (await this.fileSystem.exists(gitignorePath)) {
            predicate = MatchesGlob.fromPattern(await this.fileSystem.readTextFile(gitignorePath));
        }

        this.cache.set(gitignorePath, predicate);

        return predicate;
    }
}
