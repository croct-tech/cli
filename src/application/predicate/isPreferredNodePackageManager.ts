import {Predicate} from '@/application/predicate/predicate';
import {WorkingDirectory} from '@/application/fs/workingDirectory';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    packageManager: string,
};

export class IsPreferredNodePackageManager implements Predicate {
    private readonly projectDirectory: WorkingDirectory;

    private readonly fileSystem: FileSystem;

    private readonly packageManager: string;

    public constructor(configuration: Configuration) {
        this.projectDirectory = configuration.projectDirectory;
        this.fileSystem = configuration.fileSystem;
        this.packageManager = configuration.packageManager;
    }

    public async test(): Promise<boolean> {
        return (await this.getPreferredPackageManager())?.includes(this.packageManager) === true;
    }

    private async getPreferredPackageManager(): Promise<string|null> {
        const packagePath = this.fileSystem.joinPaths(this.projectDirectory.get(), 'package.json');

        if (!await this.fileSystem.exists(packagePath)) {
            return null;
        }

        let manifest: unknown;

        try {
            manifest = JSON.parse(await this.fileSystem.readTextFile(packagePath));
        } catch {
            return null;
        }

        if (
            typeof manifest === 'object'
            && manifest !== null
            && 'packageManager' in manifest
            && typeof manifest.packageManager === 'string'
        ) {
            return manifest.packageManager;
        }

        return null;
    }
}
