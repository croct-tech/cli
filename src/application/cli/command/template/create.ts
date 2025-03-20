import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {TemplateOptions, TemplateResources} from '@/application/cli/form/workspace/templateForm';
import {WorkspaceResources} from '@/application/template/resources';
import {
    AudienceDefinition,
    ComponentDefinition,
    ExperienceDefinition,
    SlotDefinition,
} from '@/application/api/workspace';
import {ExperienceStatus} from '@/application/model/experience';
import {FileSystem} from '@/application/fs/fileSystem';
import {Template} from '@/application/template/template';
import {Input} from '@/application/cli/io/input';
import {HelpfulError, ErrorReason} from '@/application/error';

export type CreateTemplateInput = {
    file?: string,
    empty?: boolean,
};

export type CreateTemplateConfig = {
    fileSystem: FileSystem,
    configurationManager: ConfigurationManager,
    templateForm: Form<TemplateResources, TemplateOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class CreateTemplateCommand implements Command<CreateTemplateInput> {
    private readonly config: CreateTemplateConfig;

    public constructor(config: CreateTemplateConfig) {
        this.config = config;
    }

    public async execute(input: CreateTemplateInput): Promise<void> {
        const {fileSystem, io} = this.config;

        const template = await this.createTemplate(input.empty ?? false);
        const templateFile = input.file ?? fileSystem.joinPaths('.', 'template.json');

        try {
            let override = false;

            if (await fileSystem.exists(templateFile)) {
                override = await (io.input?.confirm({
                    message: `Overwrite existing file at \`${templateFile}\`?`,
                    default: false,
                })) ?? false;
            }

            await fileSystem.writeTextFile(templateFile, JSON.stringify(template, null, 2), {
                overwrite: override,
            });
        } catch (error) {
            throw new HelpfulError('Failed to write template file', {
                reason: ErrorReason.OTHER,
                cause: error,
            });
        }

        io.output.confirm(`Template created at \`${templateFile}\``);
    }

    private async createTemplate(empty: boolean): Promise<Template> {
        if (empty) {
            return {
                // @todo: Add $schema property
                title: 'My template',
                actions: [],
            };
        }

        const resources = await this.exportResources();

        return {
            // @todo: Add $schema property
            title: 'My template',
            actions: [
                {
                    name: 'create-resource',
                    resources: resources,
                },
            ],
        };
    }

    private async exportResources(): Promise<WorkspaceResources> {
        const {configurationManager, templateForm: form} = this.config;

        const configuration = await configurationManager.resolve();

        const resources = await form.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
        });

        const template: WorkspaceResources = {
            audiences: Object.fromEntries(
                resources.audiences.map<[string, AudienceDefinition]>(
                    audience => [audience.slug, {
                        name: audience.name,
                        criteria: audience.criteria,
                    }],
                ),
            ),
            components: Object.fromEntries(
                resources.components.map<[string, ComponentDefinition]>(
                    component => [component.slug, {
                        name: component.name,
                        description: component.description,
                        definition: component.definition,
                    }],
                ),
            ),
            slots: Object.fromEntries(
                resources.slots.map<[string, SlotDefinition]>(
                    slot => [slot.slug, {
                        name: slot.name,
                        component: slot.component?.slug ?? '',
                        content: slot.content,
                    }],
                ),
            ),
            experiences: resources.experiences.map(
                experience => {
                    const {experiment} = experience;

                    const experimentDefinition: ExperienceDefinition['experiment'] = experiment !== undefined
                        ? {
                            name: experiment.name ?? '',
                            goalId: experiment.goalId,
                            crossDevice: experiment.crossDevice,
                            traffic: experiment.traffic ?? 1,
                            variants: experiment.variants.map(
                                variant => ({
                                    name: variant.name ?? '',
                                    content: variant.content,
                                    baseline: variant.baseline,
                                    allocation: variant.allocation ?? (1000 / experiment.variants.length),
                                }),
                            ),
                        }
                        : undefined;

                    return {
                        name: experience.name,
                        draft: experience.status === ExperienceStatus.DRAFT,
                        audiences: experience.audiences,
                        slots: experience.slots,
                        content: experience.content,
                        ...(experimentDefinition !== undefined ? {experiment: experimentDefinition} : {}),
                    };
                },
            ),
        };

        for (const [key, value] of Object.entries(template) as Array<[keyof WorkspaceResources, any]>) {
            if (
                typeof value === 'object' && value !== null
                && (
                    (Array.isArray(value) && value.length === 0)
                    || Object.keys(value).length === 0
                )
            ) {
                delete template[key];
            }
        }

        return template;
    }
}
