import {installPackage} from '@antfu/install-pkg';
import {resolveCommand} from 'package-manager-detector/commands';
import {detect} from 'package-manager-detector/detect';
import {NodePackageManager} from '@/application/project/manager/nodeProjectManager';
import {PackageInstallationOptions} from '@/application/project/manager/projectManager';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Command} from '@/application/project/manager/javaScriptProjectManager';

export class AntfuPackageManager implements NodePackageManager {
    private readonly directory: string;

    public constructor(directory: string) {
        this.directory = directory;
    }

    public async getScriptCommand(script: string, args: string[]): Promise<Command> {
        const result = await detect({
            cwd: this.directory,
        });

        if (result === null) {
            throw new HelpfulError('No package manager found.', {
                reason: ErrorReason.PRECONDITION,
            });
        }

        const command = resolveCommand(result.agent, 'run', [script, ...args]);

        if (command === null) {
            throw new HelpfulError(`Package manager ${result.name} does not support running scripts.`, {
                reason: ErrorReason.PRECONDITION,
            });
        }

        return {
            name: command.command,
            args: command.args,
        };
    }

    public async installPackage(packageName: string|string[], options?: PackageInstallationOptions): Promise<void> {
        await installPackage(packageName, {
            cwd: this.directory,
            silent: true,
            dev: options?.dev,
        });
    }
}
