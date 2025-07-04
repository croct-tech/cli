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
    result?: Record<string, string>,
    help?: Pick<Help, | 'links' | 'suggestions'> & {
        message?: string,
    },
};

export type Configuration = {
    packageManager: PackageManager,
};

type DependencyCheck = {
    dependency: string,
    satisfied: boolean,
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

        let checks: DependencyCheck[];

        try {
            checks = await Promise.all(options.dependencies.map(requirement => this.checkRequirement(requirement)));
        } finally {
            notifier?.stop();
        }

        const missing: DependencyCheck[] = [];

        for (const check of checks) {
            if (options?.result?.[check.dependency] !== undefined) {
                context.set(options.result[check.dependency], check.satisfied);

                continue;
            }

            if (check.issue !== undefined) {
                missing.push(check);
            }
        }

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

        if (version === undefined) {
            const installed = await this.packageManager.hasDirectDependency(name);

            if (installed || optional) {
                return {
                    dependency: name,
                    satisfied: installed,
                };
            }
        } else {
            const installed = await this.packageManager.hasDirectDependency(name, version);

            if (installed || optional) {
                return {
                    dependency: name,
                    satisfied: installed,
                };
            }
        }

        const info = await this.packageManager.getDependency(name);

        return {
            dependency: name,
            satisfied: false,
            issue: info === null
                ? 'not installed'
                : `${version !== undefined ? `version \`${version}\` is required` : ''
                }found \`${info.version ?? 'unknown'}\``,
        };
    }
}
