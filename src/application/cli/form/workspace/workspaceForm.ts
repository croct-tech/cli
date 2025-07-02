import {System} from '@/infrastructure/system';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {OrganizationApi} from '@/application/api/organization';
import {NameInput} from '@/application/cli/form/input/nameInput';
import {Organization} from '@/application/model/organization';
import {Workspace} from '@/application/model/workspace';

export type Configuration = {
    input: Input,
    output: Output,
    organizationApi: OrganizationApi,
};

export type WorkspaceOptions = {
    organization: Organization,
    new?: boolean,
    default?: string,
};

export type SelectedWorkspace = Workspace & {
    new?: boolean,
};

export class WorkspaceForm implements Form<Workspace, WorkspaceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: WorkspaceOptions): Promise<SelectedWorkspace> {
        const {organizationApi: api, output, input} = this.config;
        const {organization} = options;

        if (options.new === false) {
            const notifier = output.notify('Loading workspaces');

            const workspaces = await api.getWorkspaces({
                organizationSlug: organization.slug,
            });

            const defaultWorkspace = WorkspaceForm.getDefaultWorkspace(workspaces, options.default);

            if (defaultWorkspace !== null) {
                notifier.confirm(`Workspace: ${defaultWorkspace.name}`);

                return defaultWorkspace;
            }

            notifier.stop();

            if (workspaces.length > 0) {
                return input.select({
                    message: 'Select workspace',
                    options: workspaces.map(
                        option => ({
                            value: option,
                            label: option.name,
                        }),
                    ),
                });
            }
        }

        return this.setupWorkspace(organization, options.new === true);
    }

    private async setupWorkspace(organization: Organization, customized: boolean): Promise<SelectedWorkspace> {
        const {organizationApi: api, input, output} = this.config;

        const name = customized
            ? await NameInput.prompt({
                input: input,
                label: 'Workspace name',
                default: organization.name,
            })
            : organization.name;

        const defaultLocale = System.getLocale();
        const timeZone = System.getTimeZone();

        const notifier = output.notify('Creating workspace');

        try {
            const workspace = await api.createWorkspace({
                organizationSlug: organization.slug,
                name: name,
                website: organization.website,
                defaultLocale: defaultLocale,
                timeZone: timeZone,
            });

            notifier.confirm(`Workspace: ${workspace.name}`);

            return {
                ...workspace,
                new: customized,
            };
        } finally {
            notifier.stop();
        }
    }

    private static getDefaultWorkspace(workspaces: Workspace[], defaultSlug?: string): Workspace | null {
        if (workspaces.length === 1) {
            return workspaces[0];
        }

        if (defaultSlug !== undefined) {
            return workspaces.find(({slug}) => slug === defaultSlug) ?? null;
        }

        return null;
    }
}
