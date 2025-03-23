import {Predicate} from '@/application/predicate/predicate';
import {PackageManager} from '@/application/project/packageManager/packageManager';

export type Configuration = {
    packageManager: PackageManager,
    dependencies: string[],
};

export class HasDependency implements Predicate {
    private readonly packageManager: PackageManager;

    private readonly dependencies: string[];

    public constructor({packageManager, dependencies}: Configuration) {
        this.packageManager = packageManager;
        this.dependencies = dependencies;
    }

    public async test(): Promise<boolean> {
        const results = await Promise.all(
            this.dependencies.map(dependency => this.packageManager.hasDirectDependency(dependency)),
        );

        return results.some(result => result);
    }
}
