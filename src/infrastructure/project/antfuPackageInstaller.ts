import {installPackage} from '@antfu/install-pkg';
import {NodePackageInstaller} from '@/application/project/manager/nodeProjectManager';
import {PackageInstallationOptions} from '@/application/project/manager/projectManager';

export class AntfuPackageInstaller implements NodePackageInstaller {
    private readonly directory: string;

    public constructor(directory: string) {
        this.directory = directory;
    }

    public async installPackage(packageName: string|string[], options?: PackageInstallationOptions): Promise<void> {
        await installPackage(packageName, {
            cwd: this.directory,
            silent: true,
            dev: options?.dev,
        });
    }
}
