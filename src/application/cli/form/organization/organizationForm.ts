import {Organization} from '@/application/model/entities';
import {System} from '@/infrastructure/system';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
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
};

export class OrganizationForm implements Form<Organization, OrganizationOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: OrganizationOptions = {}): Promise<Organization> {
        const {userApi: api, output, input} = this.config;

        if (options.new !== true) {
            const spinner = output.createSpinner('Loading organizations');

            const organizations = await api.getOrganizations();

            spinner.stop();

            if (organizations.length === 1) {
                return organizations[0];
            }

            if (organizations.length > 0) {
                return organizations.length === 1
                    ? organizations[0]
                    : input.select({
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

        const spinner = output.createSpinner('Setting up organization').flow([
            'Visiting website',
            'Detecting tech stack',
            'Configuring organization',
            'Creating workspace',
            'Configuring applications',
            'Setting up organization',
        ]);

        try {
            const resources = await api.setupOrganization({
                website: website,
                locale: locale,
                timeZone: timeZone,
            });

            spinner.succeed(`Organization: ${resources.name}`);

            return resources;
        } finally {
            spinner.stop();
        }
    }
}
