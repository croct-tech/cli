import {Confirmation, Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {WorkspaceApi} from '@/application/api/workspace';
import {Component} from '@/application/model/component';

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
    selectionConfirmation?: Confirmation,
    includeDependencies?: boolean,
};

export class ComponentForm implements Form<Component[], ComponentOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: ComponentOptions): Promise<Component[]> {
        const {workspaceApi: api} = this.config;

        const {allowed} = options;

        const components = await api.getComponents({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
        });

        const selectedComponents = await this.selectComponents(
            options,
            allowed === undefined
                ? components
                : components.filter(({slug}) => allowed.includes(slug)),
        );

        if (options.includeDependencies !== true) {
            return selectedComponents;
        }

        for (const component of selectedComponents) {
            const references = new Set([
                ...component.metadata.directReferences,
                ...component.metadata.indirectReferences,
            ]);

            for (const reference of references) {
                if (!selectedComponents.some(({slug}) => slug === reference)) {
                    const referencedComponent = components.find(({slug}) => slug === reference);

                    if (referencedComponent !== undefined) {
                        selectedComponents.push(referencedComponent);
                    }
                }
            }
        }

        return selectedComponents;
    }

    private async selectComponents(options: ComponentOptions, components: Component[]): Promise<Component[]> {
        const {output, input} = this.config;

        const notifier = output.notify('Loading components');

        notifier.stop();

        const preselected = options.preselected ?? [];

        if (preselected.length > 0) {
            return components.filter(({slug}) => preselected.includes(slug));
        }

        const selected = options.selected ?? [];

        if (components.length === 0 || (selected.length > 0 && components.every(({slug}) => selected.includes(slug)))) {
            return components.filter(({slug}) => selected.includes(slug));
        }

        if (options.selectionConfirmation !== undefined) {
            const confirmed = await input.confirm(options.selectionConfirmation);

            if (!confirmed) {
                return components.filter(({slug}) => selected.includes(slug));
            }
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
}
