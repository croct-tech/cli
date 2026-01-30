import type {Predicate} from '@/application/predicate/predicate';
import type {PackageManager} from '@/application/project/packageManager/packageManager';

export type Configuration = {
    packageManager: PackageManager,
};

export class IsProject implements Predicate {
    private readonly packageManager: PackageManager;

    public constructor({packageManager}: Configuration) {
        this.packageManager = packageManager;
    }

    public test(): Promise<boolean> {
        return this.packageManager.isProject();
    }
}
