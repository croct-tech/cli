import {resolve as resolvePath} from 'path';
import {execFile} from 'child_process';
import {execPath} from 'node:process';
import {Linter} from '@/application/project/linter';
import {PackageInfo, ProjectManager} from '@/application/project/manager/projectManager';

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
};

export class JavaScriptLinter implements Linter {
    private readonly tools: LinterTool[];

    private readonly projectManager: ProjectManager;

    public constructor({tools, projectManager}: Configuration) {
        this.tools = tools;
        this.projectManager = projectManager;
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
        const options = {
            cwd: this.projectManager.getRootPath(),
            timeout: 5000,
            stdio: 'ignore',
        };

        return new Promise((resolve, reject) => {
            execFile(execPath, [executable, ...args], options, error => {
                if (error !== null) {
                    reject(error);
                } else {
                    resolve();
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
                executable: resolvePath(info.path, bin),
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
