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
    default?: string[],
    selected?: string[],
};

export class ComponentForm implements Form<Component[], ComponentOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: ComponentOptions): Promise<Component[]> {
        const {workspaceApi: api, output, input} = this.config;

        const notifier = output.notify('Loading components');

        const components = await api.getComponents({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
        });

        notifier.stop();

        if (components.length === 0) {
            return [];
        }

        const defaultComponents = options.default ?? [];

        if (defaultComponents.length > 0) {
            return components.filter(({slug}) => defaultComponents.includes(slug));
        }

        const selected = options.selected ?? [];

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
}
