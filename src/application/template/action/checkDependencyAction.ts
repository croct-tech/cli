import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ProjectManager} from '@/application/project/manager/projectManager';
import {Help} from '@/application/error';
import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';

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
    projectManagerProvider: ParameterlessProvider<ProjectManager>,
};

type DependencyCheck = {
    dependency: string,
    issue?: string,
};

export class CheckDependencyAction implements Action<CheckDependencyOptions> {
    private readonly projectManagerProvider: ParameterlessProvider<ProjectManager>;

    public constructor({projectManagerProvider}: Configuration) {
        this.projectManagerProvider = projectManagerProvider;
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
        const results = await Promise.all(options.dependencies.map(requirement => this.checkRequirement(requirement)));
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
        const projectManager = await this.projectManagerProvider.get();

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
