import {Organization} from '@/application/model/entities';
import {System} from '@/infrastructure/system';
import {Input} from '@/application/cli/io/input';
import {Notifier, Output} from '@/application/cli/io/output';
import {UserApi} from '@/application/api/user';
import {Form} from '@/application/cli/form/form';
import {UrlInput} from '@/application/cli/form/input/urlInput';

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

            const organizations = await api.getOrganizations();

            const defaultOrganization = OrganizationForm.getDefaultOrganization(organizations, options.default);

            if (defaultOrganization !== null) {
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

    private static getDefaultOrganization(organizations: Organization[], defaultSlug?: string): Organization | null {
        if (organizations.length === 1) {
            return organizations[0];
        }

        if (defaultSlug !== undefined) {
            return organizations.find(({slug}) => slug === defaultSlug) ?? null;
        }

        return null;
    }
}
