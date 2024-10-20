import {resolve} from 'path';
import {x as run} from 'tinyexec';
import {Linter} from '@/application/project/linter';
import {PackageInfo, ProjectManager} from '@/application/project/projectManager';

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

export class NodeLinter implements Linter {
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

        const cwd = this.projectManager.getDirectory();

        try {
            await run('node', [command.executable, ...command.args], {
                nodeOptions: {
                    cwd: cwd,
                    stdio: 'ignore',
                    timeout: 5000,
                },
                throwOnError: true,
            });
        } catch {
            // suppress
        }
    }

    private async getCommand(files: string[]): Promise<LinterCommand|null> {
        for (const liter of this.tools) {
            const info = await this.projectManager.getPackageInfo(liter.package);

            if (info === null) {
                continue;
            }

            const bin = NodeLinter.getBinPath(info, liter.bin);

            if (bin === null) {
                continue;
            }

            return {
                executable: resolve(info.path, bin),
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
