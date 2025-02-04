import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {Help} from '@/application/error';
import {PackageManager} from '@/application/project/packageManager/packageManager';

type Requirement = {
    name: string,
    version?: string,
    optional?: boolean,
};

export type CheckDependencyOptions = {
    dependencies: Requirement[],
    help?: Pick<Help, | 'links' | 'suggestions'> & {
        message?: string,
    },
};

export type Configuration = {
    packageManager: PackageManager,
};

type DependencyCheck = {
    dependency: string,
    issue?: string,
};

export class CheckDependencyAction implements Action<CheckDependencyOptions> {
    private readonly packageManager: PackageManager;

    public constructor({packageManager}: Configuration) {
        this.packageManager = packageManager;
    }

    public async execute(options: CheckDependencyOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Checking dependencies');

        try {
            await this.checkDependencies(options);
        } finally {
            notifier?.stop();
        }
    }

    private async checkDependencies(options: CheckDependencyOptions): Promise<void> {
        const results = await Promise.all(
            options.dependencies.map(requirement => this.checkRequirement(requirement)),
        );
        const missing = results.filter(result => result.issue !== undefined);

        if (missing.length > 0) {
            const {message, ...help} = options.help ?? {};

            throw new ActionError(message ?? 'Missing required dependencies.', {
                ...help,
                details: missing.map(({dependency, issue}) => `\`${dependency}\`: ${issue}`),
            });
        }
    }

    private async checkRequirement(requirement: Requirement): Promise<DependencyCheck> {
        const {name, version, optional = false} = requirement;

        if (
            (optional && (version === undefined || !await this.packageManager.hasDependency(name)))
            || await this.packageManager.hasDependency(name, version)
        ) {
            return {dependency: name};
        }

        const info = await this.packageManager.getDependency(name);

        return {
            dependency: name,
            issue: info === null
                ? 'not installed'
                : `version \`${version}\` is required, found \`${info.version ?? 'unknown'}\``,
        };
    }
}
