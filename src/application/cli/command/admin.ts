import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {UserApi} from '@/application/api/user';

export type AdminInput = Record<string, never>;

export type AdminOutput = void;

export type AdminConfig = {
    output: Output,
    userApi: UserApi,
    endpoint: {
        url: string,
        parameter: string,
    },
};

export class AdminCommand implements Command<AdminInput, AdminOutput> {
    private readonly config: AdminConfig;

    public constructor(config: AdminConfig) {
        this.config = config;
    }

    public async execute(): Promise<AdminOutput> {
        const {output, userApi} = this.config;

        const spinner = output.createSpinner('Starting session');

        const sessionId = await userApi.createSession();

        spinner.stop();

        const url = new URL(this.config.endpoint.url);

        url.searchParams.set(this.config.endpoint.parameter, sessionId);

        await output.open(url.toString());
    }
}
