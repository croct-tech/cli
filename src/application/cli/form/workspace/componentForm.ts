import {Component} from '@/application/model/entities';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {WorkspaceApi} from '@/application/api/workspace';

export type Configuration = {
    input: Input,
    output: Output,
    workspaceApi: WorkspaceApi,
};

export type ComponentOptions = {
    organizationSlug: string,
    workspaceSlug: string,
    allowed?: string[],
    preselected?: string[],
    selected?: string[],
};

export class ComponentForm implements Form<Component[], ComponentOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: ComponentOptions): Promise<Component[]> {
        const {output, input} = this.config;

        const notifier = output.notify('Loading components');

        const components = await this.getComponents(options, options.allowed);

        notifier.stop();

        const selected = options.selected ?? [];

        if (components.length === 0 || (selected.length > 0 && components.every(({slug}) => selected.includes(slug)))) {
            return [];
        }

        const preselected = options.preselected ?? [];

        if (preselected.length > 0) {
            return components.filter(({slug}) => preselected.includes(slug));
        }

        return input.selectMultiple({
            message: 'Select components',
            options: components.map(
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

    private async getComponents(options: ComponentOptions, allowed?: string[]): Promise<Component[]> {
        const {workspaceApi: api} = this.config;

        const components = await api.getComponents({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
        });

        if (allowed === undefined) {
            return components;
        }

        return components.filter(({slug}) => allowed.includes(slug));
    }
}
