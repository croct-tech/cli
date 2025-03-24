import {Confirmation, Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {WorkspaceApi} from '@/application/api/workspace';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';
import {Audience} from '@/application/model/audience';

export type Configuration = {
    input: Input,
    output: Output,
    workspaceApi: WorkspaceApi,
};

export type AudienceOptions = {
    organizationSlug: string,
    workspaceSlug: string,
    allowed?: string[],
    selected?: string[],
    preselected?: string[],
    selectionConfirmation?: Confirmation,
};

export class AudienceForm implements Form<Audience[], AudienceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: AudienceOptions): Promise<Audience[]> {
        const {output, input} = this.config;

        const notifier = output.notify('Loading audiences');

        const audiences = await this.getAudiences(options, options.allowed);

        notifier.stop();

        const preselected = options.preselected ?? [];

        if (preselected.length > 0) {
            return audiences.filter(({slug}) => preselected.includes(slug));
        }

        const selected = options.selected ?? [];

        if (audiences.length === 0 || (selected.length > 0 && audiences.every(({slug}) => selected.includes(slug)))) {
            return audiences.filter(({slug}) => selected.includes(slug));
        }

        if (options.selectionConfirmation !== undefined) {
            const confirmed = await input.confirm(options.selectionConfirmation);

            if (!confirmed) {
                return audiences.filter(({slug}) => selected.includes(slug));
            }
        }

        return input.selectMultiple({
            message: 'Select audiences',
            options: audiences.map(
                option => {
                    const isSelected = selected.includes(option.slug);

                    return {
                        value: option,
                        label: option.name,
                        disabled: isSelected,
                        selected: isSelected,
                    };
                },
            ),
        });
    }

    private async getAudiences(options: ComponentOptions, allowed?: string[]): Promise<Audience[]> {
        const {workspaceApi: api} = this.config;

        const audiences = await api.getAudiences({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
        });

        if (allowed === undefined) {
            return audiences;
        }

        return audiences.filter(({slug}) => allowed.includes(slug));
    }
}
