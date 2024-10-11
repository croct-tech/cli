import {Organization, Workspace} from '@/application/model/entities';
import {System} from '@/infrastructure/system';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {OrganizationApi} from '@/application/api/organization';
import {NameInput} from '@/application/cli/form/input/nameInput';

export type Configuration = {
    input: Input,
    output: Output,
    organizationApi: OrganizationApi,
};

export type WorkspaceOptions = {
    organization: Organization,
    new?: boolean,
};

export class WorkspaceForm implements Form<Workspace, WorkspaceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: WorkspaceOptions): Promise<Workspace> {
        const {organizationApi: api, output, input} = this.config;
        const {organization} = options;

        if (options.new === false) {
            const spinner = output.createSpinner('Loading workspaces');

            const workspaces = await api.getWorkspaces({
                organizationSlug: organization.slug,
            });

            if (workspaces.length === 1) {
                spinner.succeed(`Workspace: ${workspaces[0].name}`);

                return workspaces[0];
            }

            spinner.stop();

            if (workspaces.length > 0) {
                return workspaces.length === 1
                    ? workspaces[0]
                    : input.select({
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

    private async setupWorkspace(organization: Organization, customized: boolean): Promise<Workspace> {
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

        const spinner = output.createSpinner('Creating workspace');

        try {
            const workspace = await api.createWorkspace({
                organizationId: organization.id,
                name: name,
                website: organization.website,
                defaultLocale: defaultLocale,
                timeZone: timeZone,
            });

            spinner.succeed(`Workspace: ${workspace.name}`);

            return workspace;
        } finally {
            spinner.stop();
        }
    }
}
