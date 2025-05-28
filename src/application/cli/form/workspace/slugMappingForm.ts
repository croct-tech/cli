import {Input} from '@/application/cli/io/input';
import {Form} from '@/application/cli/form/form';
import {Audience} from '@/application/model/audience';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {SlugInput} from '@/application/cli/form/input/slugInput';
import {WorkspaceApi} from '@/application/api/workspace';
import {WorkspacePath} from '@/application/api/organization';

export type Configuration = {
    input: Input,
    workspaceApi: WorkspaceApi,
};

export type SlugMappingOptions = WorkspacePath & {
    resources: {
        components: string[],
        slots: string[],
        audiences: string[],
    },
};

export type SlugMapping = {
    components: Record<string, string>,
    slots: Record<string, string>,
    audiences: Record<string, string>,
};

export class SlugMappingForm implements Form<SlugMapping, SlugMappingOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: SlugMappingOptions): Promise<SlugMapping> {
        const {input, workspaceApi: api} = this.config;
        const {resources, ...path} = options;

        const newSlots = resources.slots ?? [];
        const newComponents = resources.components ?? [];
        const newAudiences = resources.audiences ?? [];

        const [slots, components, audiences] = await Promise.all([
            newSlots.length > 0
                ? api.getSlots(path)
                : new Array<Slot>(),
            newComponents.length > 0
                ? api.getComponents(path)
                : new Array<Component>(),
            newAudiences.length > 0
                ? api.getAudiences(path)
                : new Array<Audience>(),
        ]);

        const conflictingComponents = newComponents.filter(slug => components.some(existing => existing.slug === slug));
        const componentMapping: Record<string, string> = {};

        if (conflictingComponents.length > 0) {
            const unavailableSlugs = components.map(component => component.slug);

            for (const slug of conflictingComponents) {
                const newSlug = await SlugInput.prompt({
                    input: input,
                    initial: slug,
                    unavailableSlugs: unavailableSlugs,
                    label: `Component \`${slug}\` already exists, enter a new component ID:`,
                });

                unavailableSlugs.push(newSlug);

                componentMapping[slug] = newSlug;
            }
        }

        const conflictingSlots = newSlots.filter(slug => slots.some(existing => existing.slug === slug));
        const slotMapping: Record<string, string> = {};

        if (conflictingSlots.length > 0) {
            const unavailableSlugs = slots.map(slot => slot.slug);

            for (const slug of conflictingSlots) {
                const newSlug = await SlugInput.prompt({
                    input: input,
                    initial: slug,
                    unavailableSlugs: unavailableSlugs,
                    label: `Slot \`${slug}\` already exists, enter a new slot ID:`,
                });

                unavailableSlugs.push(newSlug);

                slotMapping[slug] = newSlug;
            }
        }

        const conflictingAudiences = newAudiences.filter(slug => audiences.some(existing => existing.slug === slug));
        const audienceMapping: Record<string, string> = {};

        if (conflictingAudiences.length > 0) {
            const unavailableSlugs = audiences.map(audience => audience.slug);

            for (const slug of conflictingAudiences) {
                const newSlug = await SlugInput.prompt({
                    input: input,
                    initial: slug,
                    unavailableSlugs: unavailableSlugs,
                    label: `Audience \`${slug}\` already exists, enter a new audience ID:`,
                });

                unavailableSlugs.push(newSlug);

                audienceMapping[slug] = newSlug;
            }
        }

        return {
            components: componentMapping,
            slots: slotMapping,
            audiences: audienceMapping,
        };
    }
}
