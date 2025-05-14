import {PackageManager} from '@/application/project/packageManager/packageManager';

export interface PackageManagerAgent extends Pick<
    PackageManager,
    | 'getName'
    | 'isInstalled'
    | 'installDependencies'
    | 'addDependencies'
    | 'getScriptCommand'
    | 'getPackageCommand'
> {
}
