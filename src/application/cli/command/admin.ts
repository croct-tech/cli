import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {UserApi} from '@/application/api/user';
import {PageOptions} from '@/application/cli/form/page';
import {Form} from '@/application/cli/form/form';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';

export type AdminInput = {
    page?: string,
};

export type AdminConfig = {
    output: Output,
    configurationManager: ConfigurationManager,
    pageForm: Form<string, PageOptions>,
    userApi: UserApi,
    adminUrl: URL,
    adminTokenParameter: string,
    adminTokenDuration: number,
};

export class AdminCommand implements Command<AdminInput> {
    private readonly config: AdminConfig;

    public constructor(config: AdminConfig) {
        this.config = config;
    }

    public async execute(input: AdminInput): Promise<void> {
        const {output, pageForm, userApi} = this.config;

        const configuration = await this.config
            .configurationManager
            .load();

        const path = await pageForm.handle({
            page: input.page,
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            devApplicationSlug: configuration.applications.development,
            prodApplicationSlug: configuration.applications.production,
        });

        const notifier = output.notify('Logging in...');

        const token = await userApi.issueToken({
            duration: this.config.adminTokenDuration,
        });

        notifier.stop();

        const url = new URL(this.config.adminUrl);

        url.pathname += path.startsWith('/') ? path : `/${path}`;

        url.searchParams.set(this.config.adminTokenParameter, token);

        await output.open(url.toString());
    }
}
