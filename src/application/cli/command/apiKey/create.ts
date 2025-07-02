import clipboard from 'clipboardy';
import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {ApplicationApi} from '@/application/api/application';
import {ApiKey, ApiKeyPermission, ApplicationEnvironment} from '@/application/model/application';
import {Input} from '@/application/cli/io/input';
import {NameInput} from '@/application/cli/form/input/nameInput';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ErrorReason, HelpfulError} from '@/application/error';
import {UserApi} from '@/application/api/user';
import {FileSystem} from '@/application/fs/fileSystem';
import {WorkspaceApi} from '@/application/api/workspace';
import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';

export type CreateApiKeyInput = {
    name?: ApiKey['name'],
    permissions?: ApiKeyPermission[],
    environment?: ApplicationEnvironment,
    copy?: boolean,
};

export type CreateApiKeyConfig = {
    configurationManager: ConfigurationManager,
    fileSystem: FileSystem,
    io: {
        input: Input,
        output: Output,
    },
    api: {
        user: UserApi,
        workspace: WorkspaceApi,
        application: ApplicationApi,
    },
};

export class CreateApiKeyCommand implements Command<CreateApiKeyInput> {
    private readonly config: CreateApiKeyConfig;

    public constructor(config: CreateApiKeyConfig) {
        this.config = config;
    }

    public async execute(input: CreateApiKeyInput): Promise<void> {
        const {configurationManager, api, fileSystem, io} = this.config;
        const configuration = await configurationManager.load();

        const notifier = io.output.notify('Loading information');
        const environment = await this.getEnvironment(configuration, input.environment);
        const applicationSlug = this.getApplicationSlug(configuration, environment);
        const defaultName = input.name ?? `${(await api.user.getUser()).username} (CLI)`;
        const features = await api.workspace.getFeatures({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
        });

        notifier.stop();

        if (
            input.permissions?.includes(ApiKeyPermission.EXPORT_DATA) === true
            && features?.features.dataExport !== true
        ) {
            throw new HelpfulError(
                'The workspace does not have the data export feature enabled.',
                {
                    reason: ErrorReason.INVALID_INPUT,
                },
            );
        }

        const name = input.name ?? await NameInput.prompt({
            input: io.input,
            label: 'API key name',
            default: defaultName,
        });

        const permissions = input.permissions
            ?? await io.input.selectMultiple({
                message: 'Select permissions',
                min: 1,
                options: ApiKeyPermission.all()
                    .map(
                        value => ({
                            label: ApiKeyPermission.getLabel(value),
                            value: value,
                            disabled: value === ApiKeyPermission.EXPORT_DATA
                                && features?.features.dataExport !== true,
                        }),
                    ),
            });

        const apiKey = await api.application.createApiKey({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            applicationSlug: applicationSlug,
            name: name,
            permissions: permissions,
        });

        if (input.copy === true || await io.input.confirm({message: 'Copy to clipboard?', default: false})) {
            await clipboard.write(apiKey.secret);

            io.output.confirm('API key copied to clipboard');

            return;
        }

        const fileName = `api-key-${apiKey.id}.txt`;

        await fileSystem.writeTextFile(fileName, apiKey.secret);

        io.output.confirm(`API key saved to \`${fileName}\``);
    }

    private getApplicationSlug(configuration: ProjectConfiguration, environment: ApplicationEnvironment): string {
        const application = environment === ApplicationEnvironment.PRODUCTION
            ? configuration.applications.production
            : configuration.applications.development;

        if (application === undefined) {
            throw new HelpfulError(
                `No ${ApplicationEnvironment.getLabel(environment).toLowerCase()} application `
                + 'found in the project configuration.',
                {reason: ErrorReason.INVALID_INPUT},
            );
        }

        return application;
    }

    private getEnvironment(
        configuration: ProjectConfiguration,
        environment?: ApplicationEnvironment,
    ): Promise<ApplicationEnvironment> {
        if (environment !== undefined) {
            return Promise.resolve(environment);
        }

        if (configuration.applications.production === undefined) {
            return Promise.resolve(ApplicationEnvironment.DEVELOPMENT);
        }

        const {io: {input}} = this.config;

        return input.select({
            message: 'Select environment',
            options: ApplicationEnvironment.all()
                .map(
                    value => ({
                        label: ApplicationEnvironment.getLabel(value),
                        value: value,
                    }),
                ),
        });
    }
}
