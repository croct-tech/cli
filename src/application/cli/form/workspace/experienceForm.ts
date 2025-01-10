import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {WorkspaceApi} from '@/application/api/workspace';
import {ExperienceDetails} from '@/application/model/experience';

export type Configuration = {
    input: Input,
    output: Output,
    workspaceApi: WorkspaceApi,
};

export type ExperienceOptions = {
    organizationSlug: string,
    workspaceSlug: string,
    confirmation?: string,
};

export class ExperienceForm implements Form<ExperienceDetails[], ExperienceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: ExperienceOptions): Promise<ExperienceDetails[]> {
        const {output, input, workspaceApi: api} = this.config;

        let notifier = output.notify('Loading experiences...');

        const summaries = await api.getExperiences({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
        });

        notifier.stop();

        const {confirmation} = options;

        if (summaries.length === 0 || (confirmation !== undefined && !await input.confirm({message: confirmation}))) {
            return [];
        }

        const selection = await input.selectMultiple({
            message: 'Select experiences',
            options: summaries.map(
                option => ({
                    value: option,
                    label: option.name,
                }),
            ),
        });

        notifier = output.notify('Loading details...');

        const experiences = await Promise.all(
            selection.flatMap(
                async ({id}) => {
                    const experience = await api.getExperience({
                        experienceId: id,
                        organizationSlug: options.organizationSlug,
                        workspaceSlug: options.workspaceSlug,
                    });

                    return experience === null ? [] : [experience];
                },
            ),
        );

        notifier.stop();

        return experiences.flat();
    }
}
