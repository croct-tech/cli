import {Input} from '@/application/cli/io/input';
import {Form} from '@/application/cli/form/form';
import {AudienceOptions} from '@/application/cli/form/workspace/audienceForm';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {ExperienceOptions} from '@/application/cli/form/workspace/experienceForm';
import {Audience} from '@/application/model/audience';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {ExperienceDetails} from '@/application/model/experience';

export type Configuration = {
    input: Input,
    form: {
        component: Form<Component[], ComponentOptions>,
        slot: Form<Slot[], SlotOptions>,
        audience: Form<Audience[], AudienceOptions>,
        experience: Form<ExperienceDetails[], ExperienceOptions>,
    },
};

export type TemplateOptions = {
    organizationSlug: string,
    workspaceSlug: string,
};

export type TemplateResources = {
    components: Component[],
    slots: Slot[],
    audiences: Audience[],
    experiences: ExperienceDetails[],
};

export class TemplateForm implements Form<TemplateResources, TemplateOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: TemplateOptions): Promise<TemplateResources> {
        const {input, form} = this.config;

        const template: TemplateResources = {
            components: [],
            slots: [],
            audiences: [],
            experiences: [],
        };

        const preselectedAudiences: string[] = [];
        const preselectedSlots: string[] = [];

        const experiences = await form.experience.handle({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
            confirmation: 'Do you want to include experiences?',
        });

        if (experiences.length > 0) {
            preselectedAudiences.push(...experiences.flatMap(experience => experience.audiences));
            preselectedSlots.push(...experiences.flatMap(experience => experience.slots));

            template.experiences = experiences;

            if (experiences.some(experience => experience.experiment !== undefined)) {
                if (
                    !await input.confirm({
                        message: 'Do you want to include experiments?',
                        default: false,
                    })
                ) {
                    template.experiences = template.experiences.map(experience => {
                        const {experiment, ...rest} = experience;

                        return rest;
                    });
                }
            }
        }

        template.slots = await form.slot.handle({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
            selected: preselectedSlots,
            selectionConfirmation: {
                message: preselectedSlots.length > 0
                    ? 'Do you want to include other slots?'
                    : 'Do you want to include slots?',
                default: false,
            },
        });

        const preselectedComponents = [...new Set(template.slots.map(slot => slot.component?.slug ?? ''))];

        template.components = await form.component.handle({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
            includeDependencies: true,
            selected: preselectedComponents,
            selectionConfirmation: {
                message: preselectedComponents.length > 0
                    ? 'Do you want to include other components?'
                    : 'Do you want to include components?',
                default: false,
            },
        });

        template.audiences = await form.audience.handle({
            organizationSlug: options.organizationSlug,
            workspaceSlug: options.workspaceSlug,
            selected: preselectedAudiences,
            selectionConfirmation: {
                message: preselectedAudiences.length > 0
                    ? 'Do you want to include other audiences?'
                    : 'Do you want to include audiences?',
                default: false,
            },
        });

        return template;
    }
}
