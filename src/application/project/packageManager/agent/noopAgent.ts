import {Command} from '@/application/process/command';
import {PackageManagerAgent} from '@/application/project/packageManager/agent/packageManagerAgent';
import {PackageManagerError} from '@/application/project/packageManager/packageManager';

export class NoopAgent implements PackageManagerAgent {
    public isInstalled(): Promise<boolean> {
        return Promise.resolve(false);
    }

    public addDependencies(): Promise<void> {
        return this.fail();
    }

    public installDependencies(): Promise<void> {
        return this.fail();
    }

    public getPackageCommand(): Promise<Command> {
        return this.fail();
    }

    public getScriptCommand(): Promise<Command> {
        return this.fail();
    }

    private fail(): never {
        throw new PackageManagerError('The package manager is not installed');
    }
}
