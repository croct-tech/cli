import {Slot} from '@/application/model/entities';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {WorkspaceApi} from '@/application/api/workspace';

export type Configuration = {
    input: Input,
    output: Output,
    workspaceApi: WorkspaceApi,
};

export type SlotOptions = {
    organizationSlug: string,
    workspaceSlug: string,
    default?: string[],
    selected?: string[],
};

export class SlotForm implements Form<Slot[], SlotOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: SlotOptions): Promise<Slot[]> {
        const {workspaceApi: api, output, input} = this.config;

        const notifier = output.notify('Loading slots');

        const slots = await api.getSlots({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
        });

        notifier.stop();

        if (slots.length === 0) {
            return [];
        }

        const defaultSlots = options.default ?? [];

        if (defaultSlots.length > 0) {
            return slots.filter(({slug}) => defaultSlots.includes(slug));
        }

        const selected = options.selected ?? [];

        console.log(selected);

        return input.selectMultiple({
            message: 'Select slots',
            options: slots.map(
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
}
