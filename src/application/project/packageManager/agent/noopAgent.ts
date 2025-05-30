import {Command} from '@/application/system/process/command';
import {PackageManagerAgent} from '@/application/project/packageManager/agent/packageManagerAgent';
import {PackageManagerError} from '@/application/project/packageManager/packageManager';

export class NoopAgent implements PackageManagerAgent {
    public getName(): Promise<string> {
        return Promise.resolve('noop');
    }

    public isInstalled(): Promise<boolean> {
        return Promise.resolve(false);
    }

    public addDependencies(): Promise<void> {
        return this.fail();
    }

    public installDependencies(): Promise<void> {
        return this.fail();
    }

    public updatePackage(): Promise<void> {
        return this.fail();
    }

    public getPackageCommand(): Promise<Command> {
        return this.fail();
    }

    public getScriptCommand(): Promise<Command> {
        return this.fail();
    }

    public getPackageUpdateCommand(): Promise<Command> {
        return this.fail();
    }

    private fail(): never {
        throw new PackageManagerError('The package manager is not installed');
    }
}
