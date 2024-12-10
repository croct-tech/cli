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
    allowed?: string[],
    preselected?: string[],
    selected?: string[],
};

export class SlotForm implements Form<Slot[], SlotOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: SlotOptions): Promise<Slot[]> {
        const {output, input} = this.config;

        const notifier = output.notify('Loading slots');

        const slots = await this.getSlots(options, options.allowed);

        notifier.stop();

        const preselected = options.preselected ?? [];

        if (preselected.length > 0) {
            return slots.filter(({slug}) => preselected.includes(slug));
        }

        const selected = options.selected ?? [];

        if (slots.length === 0 || (selected.length > 0 && slots.every(({slug}) => selected.includes(slug)))) {
            return [];
        }

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

    private async getSlots(options: SlotOptions, allowed?: string[]): Promise<Slot[]> {
        const {workspaceApi: api} = this.config;

        const slots = await api.getSlots({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
        });

        if (allowed === undefined) {
            return slots;
        }

        return slots.filter(({slug}) => allowed.includes(slug));
    }
}
