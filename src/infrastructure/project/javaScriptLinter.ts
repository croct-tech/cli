import {spawn} from 'child_process';
import {execPath} from 'node:process';
import {Linter} from '@/application/project/linter';
import {PackageInfo, ProjectManager} from '@/application/project/manager/projectManager';
import {FileSystem} from '@/application/fs/fileSystem';

type LinterCommand = {
    executable: string,
    args: string[],
};

type LinterTool = {
    package: string,
    bin?: string,
    args(files: string[]): string[],
};

export type Configuration = {
    tools: LinterTool[],
    projectManager: ProjectManager,
    fileSystem: FileSystem,
};

export class JavaScriptLinter implements Linter {
    private readonly tools: LinterTool[];

    private readonly projectManager: ProjectManager;

    private readonly fileSystem: FileSystem;

    public constructor({tools, projectManager, fileSystem}: Configuration) {
        this.tools = tools;
        this.projectManager = projectManager;
        this.fileSystem = fileSystem;
    }

    public async fix(files: string[]): Promise<void> {
        const command = await this.getCommand(files);

        if (command === null) {
            return;
        }

        try {
            await this.runCommand(command.executable, command.args);
        } catch {
            // suppress
        }
    }

    private runCommand(executable: string, args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const result = spawn(execPath, [executable, ...args], {
                cwd: this.projectManager.getRootPath(),
                timeout: 5000,
                stdio: 'ignore',
            });

            result.on('error', reject);

            result.on('exit', code => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Failed to run linter with exit code ${code}`));
                }
            });
        });
    }

    private async getCommand(files: string[]): Promise<LinterCommand|null> {
        for (const liter of this.tools) {
            if (!await this.projectManager.isPackageListed(liter.package)) {
                // Ensure the package is a direct dependency
                continue;
            }

            const info = await this.projectManager.getPackageInfo(liter.package);

            if (info === null) {
                continue;
            }

            const bin = JavaScriptLinter.getBinPath(info, liter.bin);

            if (bin === null) {
                continue;
            }

            return {
                executable: this.fileSystem.joinPaths(
                    info.directory,
                    this.fileSystem.normalizeSeparators(bin),
                ),
                args: liter.args(files),
            };
        }

        return null;
    }

    private static getBinPath({metadata}: PackageInfo, bin?: string): string|null {
        if (!('bin' in metadata)) {
            return null;
        }

        if (typeof metadata.bin === 'string') {
            return metadata.bin;
        }

        if (
            bin !== undefined
            && typeof metadata.bin === 'object'
            && metadata.bin !== null
            && typeof metadata.bin[bin] === 'string'
        ) {
            return metadata.bin[bin];
        }

        return null;
    }
}
