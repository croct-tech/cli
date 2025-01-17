import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ProjectManager} from '@/application/project/manager/projectManager';

import {Help} from '@/application/error';

type Requirement = {
    name: string,
    version?: string,
    optional?: boolean,
};

type DependencyCheck = {
    dependency: string,
    issue?: string,
};

export type CheckDependenciesOptions = {
    dependencies: Requirement[],
    help?: Pick<Help, | 'links' | 'suggestions'> & {
        message?: string,
    },
};

export type Configuration = {
    projectManager: ProjectManager,
};

export class CheckDependencies implements Action<CheckDependenciesOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Keep the same signature as the interface
    public async execute(options: CheckDependenciesOptions, _: ActionContext): Promise<void> {
        const results = await Promise.all(options.dependencies.map(requirement => this.check(requirement)));
        const missing = results.filter(result => result.issue !== undefined);

        if (missing.length > 0) {
            const {message, ...help} = options.help ?? {};

            throw new ActionError(message ?? 'Missing required dependencies.', {
                ...help,
                details: missing.map(({dependency, issue}) => `\`${dependency}\`: ${issue}`),
            });
        }
    }

    private async check(requirement: Requirement): Promise<DependencyCheck> {
        const {name, version, optional = false} = requirement;
        const {projectManager} = this.config;

        if (
            (optional && (version === undefined || !await projectManager.isPackageListed(name)))
            || await projectManager.isPackageListed(name, version)
        ) {
            return {dependency: name};
        }

        const info = await projectManager.getPackageInfo(name);

        return {
            dependency: name,
            issue: info === null
                ? 'not installed'
                : `version \`${version}\` is required, found \`${info.version ?? 'unknown'}\``,
        };
    }
}

declare module '@/application/template/action/action' {
    export interface ActionOptionsMap {
        'check-dependencies': CheckDependenciesOptions;
    }
}
