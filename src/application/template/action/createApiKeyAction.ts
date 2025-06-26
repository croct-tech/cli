import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ApplicationApi, GeneratedApiKey} from '@/application/api/application';
import {ApiKeyPermission} from '@/application/model/application';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ErrorReason} from '@/application/error';

export type CreateApiKeyOptions = {
    keyName: string,
    environment: 'development' | 'production',
    permissions: ApiKeyPermission[],
    result: string,
};

export type Configuration = {
    applicationApi: ApplicationApi,
    configurationManager: ConfigurationManager,
};

export class CreateApiKeyAction implements Action<CreateApiKeyOptions> {
    private readonly configurationManager: ConfigurationManager;

    private readonly api: ApplicationApi;

    public constructor({configurationManager, applicationApi}: Configuration) {
        this.configurationManager = configurationManager;
        this.api = applicationApi;
    }

    public async execute(options: CreateApiKeyOptions, context: ActionContext): Promise<void> {
        const {output} = context;
        const configuration = await this.configurationManager.load();

        const applicationSlug = options.environment === 'production'
            ? configuration.applications.production
            : configuration.applications.development;

        if (applicationSlug === undefined) {
            throw new ActionError('The project has no application configured for the selected environment.', {
                reason: ErrorReason.PRECONDITION,
            });
        }

        const notifier = output?.notify('Creating API key');

        let apiKey: GeneratedApiKey;

        try {
            apiKey = await this.api.createApiKey({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
                applicationSlug: applicationSlug,
                name: options.keyName,
                permissions: options.permissions,
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }

        context.set(options.result, apiKey.secret);
    }
}
