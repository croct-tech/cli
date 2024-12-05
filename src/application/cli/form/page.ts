import {Input} from '@/application/cli/io/input';
import {Form} from '@/application/cli/form/form';

export type Configuration = {
    input: Input,
};

export type PageOptions = {
    organizationSlug: string,
    workspaceSlug: string,
    devApplicationSlug: string,
    prodApplicationSlug: string,
};

type Placeholder = 'organization' | 'workspace' | 'dev-application' | 'prod-application';

export class PageForm implements Form<string, PageOptions> {
    private static SITEMAP: Record<string, string> = {
        Home: '/',
        'Personal settings': '/settings',
        Organization: '/organizations/:organization',
        'Organization settings': '/organizations/:organization/settings',
        'Organization users': '/organizations/:organization/users',
        Workspace: '/organizations/:organization/workspaces/:workspace',
        'Workspace settings': '/organizations/:organization/workspaces/:workspace/settings',
        'Workspace users': '/organizations/:organization/workspaces/:workspace/users',
        'Dev application': '/organizations/:organization/workspaces/:workspace/applications/:dev-application',
        'Prod application': '/organizations/:organization/workspaces/:workspace/applications/:prod-application',
        'Dev application settings': '/organizations/:organization/workspaces/:workspace/applications/:dev-application/settings',
        'Prod application settings': '/organizations/:organization/workspaces/:workspace/applications/:prod-application/settings',
        Slots: '/organizations/:organization/workspaces/:workspace/slots',
        Components: '/organizations/:organization/workspaces/:workspace/components',
        Experiences: '/organizations/:organization/workspaces/:workspace/experiences',
    };

    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: PageOptions): Promise<string> {
        const {input} = this.config;

        const path = await input.select({
            message: 'Where do you want to go?',
            options: Object.entries(PageForm.SITEMAP).map(
                ([label, value]) => ({
                    value: value,
                    label: label,
                }),
            ),
        });

        return PageForm.resolvePath(path, options);
    }

    private static resolvePath(path: string, options: PageOptions): string {
        return path.replace(/:(organization|workspace|(dev|prod)-application)/g, (_, placeholder: Placeholder) => {
            switch (placeholder) {
                case 'organization':
                    return options.organizationSlug;

                case 'workspace':
                    return options.workspaceSlug;

                case 'dev-application':
                    return options.devApplicationSlug;

                case 'prod-application':
                    return options.prodApplicationSlug;
            }
        });
    }
}
