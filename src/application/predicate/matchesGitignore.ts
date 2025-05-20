import ignore from 'ignore';
import {Predicate} from '@/application/predicate/predicate';
import {FileSystem} from '@/application/fs/fileSystem';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';

export type Configuration = {
    fileSystem: FileSystem,
    workingDirectory: WorkingDirectory,
};

export class MatchesGitignore implements Predicate<[string]> {
    private readonly fileSystem: FileSystem;

    private readonly workingDirectory: WorkingDirectory;

    // The cache stores predicates for each `.gitignore` file path. 
    // By default, the predicate returns `false`, ensuring no paths are ignored 
    // when no `.gitignore` file is present.
    private readonly cache: Map<string, Predicate<[string]>> = new Map();

    public constructor({fileSystem, workingDirectory}: Configuration) {
        this.fileSystem = fileSystem;
        this.workingDirectory = workingDirectory;
    }

    public async test(path: string): Promise<boolean> {
        return (await this.getPredicate()).test(path);
    }

    private async getPredicate(): Promise<Predicate<[string]>> {
        const workingDirectory = this.workingDirectory.get();
        const gitignorePath = this.fileSystem.joinPaths(workingDirectory, '.gitignore');

        if (this.cache.has(gitignorePath)) {
            return this.cache.get(gitignorePath)!;
        }

        let predicate: Predicate<[string]> = {
            test: () => Promise.resolve(false),
        };

        if (await this.fileSystem.exists(gitignorePath)) {
            const instance = ignore();

            instance.add(await this.fileSystem.readTextFile(gitignorePath));

            predicate = {
                test: (path: string): Promise<boolean> => {
                    if (!this.fileSystem.isSubPath(workingDirectory, path)) {
                        return Promise.resolve(false);
                    }

                    const relativePath = this.fileSystem.getRelativePath(workingDirectory, path);

                    if (relativePath === '') {
                        return Promise.resolve(false);
                    }

                    return Promise.resolve(instance.ignores(relativePath));
                },
            };
        }

        this.cache.set(gitignorePath, predicate);

        return predicate;
    }
}
