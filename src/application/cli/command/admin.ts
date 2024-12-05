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
    endpoint: {
        url: string,
        parameter: string,
    },
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
            .resolve();

        const path = await pageForm.handle({
            page: input.page,
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            devApplicationSlug: configuration.applications.development,
            prodApplicationSlug: configuration.applications.production,
        });

        const notifier = output.notify('Starting session');

        const sessionId = await userApi.createSession();

        notifier.stop();

        const url = new URL(path.startsWith('/') ? path.slice(1) : path, this.config.endpoint.url);

        url.searchParams.set(this.config.endpoint.parameter, sessionId);

        await output.open(url.toString());
    }
}
