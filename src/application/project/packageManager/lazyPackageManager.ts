import {Dependency, PackageManager, PackageManagerError} from '@/application/project/packageManager/packageManager';
import {Command} from '@/application/system/process/command';
import {Provider, ProviderError} from '@/application/provider/provider';

export class LazyPackageManager implements PackageManager {
    private readonly provider: Provider<PackageManager>;

    public constructor(detector: Provider<PackageManager>) {
        this.provider = detector;
    }

    private get manager(): Promise<PackageManager> {
        return Promise.resolve(this.provider.get()).catch(error => {
            if (error instanceof ProviderError) {
                throw new PackageManagerError(error.message, error.help);
            }

            throw error;
        });
    }

    public async isInstalled(): Promise<boolean> {
        return (await this.manager).isInstalled();
    }

    public async isProject(): Promise<boolean> {
        return (await this.manager).isProject();
    }

    public async hasDependency(packageName: string, version?: string): Promise<boolean> {
        return (await this.manager).hasDependency(packageName, version);
    }

    public async hasDirectDependency(packageName: string, version?: string): Promise<boolean> {
        return (await this.manager).hasDirectDependency(packageName, version);
    }

    public async getDependency(name: string): Promise<Dependency|null> {
        return (await this.manager).getDependency(name);
    }

    public async addDependencies(dependencies: string[], dev?: boolean): Promise<void> {
        return (await this.manager).addDependencies(dependencies, dev);
    }

    public async installDependencies(): Promise<void> {
        return (await this.manager).installDependencies();
    }

    public async getScripts(): Promise<Record<string, string>> {
        return (await this.manager).getScripts();
    }

    public async addScript(name: string, command: string): Promise<void> {
        return (await this.manager).addScript(name, command);
    }

    public async getScriptCommand(script: string, args?: string[]): Promise<Command> {
        return (await this.manager).getScriptCommand(script, args);
    }

    public async getPackageCommand(packageName: string, args?: string[]): Promise<Command> {
        return (await this.manager).getPackageCommand(packageName, args);
    }
}
