import {System} from '@/infrastructure/system';
import {Input} from '@/application/cli/io/input';
import {Notifier, Output} from '@/application/cli/io/output';
import {UserApi} from '@/application/api/user';
import {Form} from '@/application/cli/form/form';
import {UrlInput} from '@/application/cli/form/input/urlInput';
import {Organization} from '@/application/model/organization';

export type Configuration = {
    input: Input,
    output: Output,
    userApi: UserApi,
};

export type OrganizationOptions = {
    new?: boolean,
    default?: string,
};

export class OrganizationForm implements Form<Organization, OrganizationOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: OrganizationOptions = {}): Promise<Organization> {
        const {userApi: api, output, input} = this.config;

        if (options.new !== true) {
            const notifier = output.notify('Loading organizations');

            const organizations: Organization[] = [];

            if (options.default !== undefined) {
                const defaultOrganization = await api.getOrganization(options.default);

                if (defaultOrganization !== null) {
                    organizations.push(defaultOrganization);
                }
            }

            if (organizations.length === 0) {
                organizations.push(...await api.getOrganizations());
            }

            if (organizations.length === 1) {
                const defaultOrganization = organizations[0];

                notifier.confirm(`Organization: ${defaultOrganization.name}`);

                return defaultOrganization;
            }

            notifier.stop();

            if (organizations.length > 0) {
                return input.select({
                    message: 'Select organization',
                    options: organizations.map(
                        option => ({
                            value: option,
                            label: option.name,
                        }),
                    ),
                });
            }
        }

        const timeZone = System.getTimeZone();
        const locale = System.getLocale();

        output.inform('Setting up a new organization');
        output.inform('*By continuing, you agree to our [Terms of Service](https://croct.link/terms-of-service)*');

        const website = await UrlInput.prompt({
            input: input,
            label: 'Organization website',
        });

        const notifier = this.notify('Setting up organization');

        try {
            const resources = await api.setupOrganization({
                website: website,
                locale: locale,
                timeZone: timeZone,
            });

            notifier.confirm(`Organization: ${resources.name}`);

            return resources;
        } finally {
            notifier.stop();
        }
    }

    private notify(initialStatus: string): Pick<Notifier, 'confirm' | 'stop'> {
        const {output} = this.config;

        const statuses = [
            'Visiting website',
            'Detecting tech stack',
            'Configuring organization',
            'Creating workspace',
            'Configuring applications',
            'Setting up organization',
        ];

        const notifier = output.notify(initialStatus);

        let frame = 0;
        const interval = setInterval(
            () => {
                if (frame >= statuses.length) {
                    clearInterval(interval);
                } else {
                    notifier.update(statuses[frame++]);
                }
            },
            3000,
        );

        return {
            confirm: (status, details): void => {
                clearInterval(interval);
                notifier.confirm(status, details);
            },
            stop: (persist): void => {
                clearInterval(interval);
                notifier.stop(persist);
            },
        };
    }
}
