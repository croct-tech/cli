import {Action} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';
import {WorkspaceApi} from '@/application/api/workspace';
import {Template} from '@/application/template/template';

export type CreateResourceOptions = Template;

export type Configuration = {
    workspaceApi: WorkspaceApi,
};

type ContentResources = {
    slots: Set<string>,
    audiences: Set<string>,
    locales: Set<string>,
    dynamicContent: boolean,
};

type ExperienceResources = ContentResources & {
    name: string,
    multipleAudiences: boolean,
    crossDevice: boolean,
    dynamicContent: boolean,
};

type TemplateAnalysis = {
    components: Set<string>,
    slots: Set<string>,
    audiences: Set<string>,
    locales: Set<string>,
    experiences: ExperienceResources[],
};

export class CreateResource implements Action<CreateResourceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: CreateResourceOptions, context: ActionContext): Promise<void> {
        const analysis = Template.analyze(options);
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'create-resource': CreateResourceOptions;
    }
}
