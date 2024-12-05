/* eslint-disable max-len -- Avoid wrapping URLs */
import stringSimilarity from 'string-similarity-js';
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
    page?: string,
};

type Placeholder = 'organization' | 'workspace' | 'dev-application' | 'prod-application';

export class PageForm implements Form<string, PageOptions> {
    private static SITEMAP: Record<string, string> = {
        Home: '/',
        'Personal settings': '/settings',
        Organization: '/organizations/:organization',
        'Organization settings': '/organizations/:organization/settings',
        'Organization members': '/organizations/:organization/members',
        Workspace: '/organizations/:organization/workspaces/:workspace',
        'Workspace settings': '/organizations/:organization/workspaces/:workspace/settings',
        'Workspace members': '/organizations/:organization/workspaces/:workspace/members',
        'Dev application': '/organizations/:organization/workspaces/:workspace/applications/:dev-application/dashboard',
        'Prod application': '/organizations/:organization/workspaces/:workspace/applications/:prod-application/dashboard',
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
        return PageForm.resolvePath(await this.getPage(options.page), options);
    }

    private getPage(page?: string): Promise<string> {
        if (page !== undefined) {
            const match = PageForm.findMatch(page);

            if (match !== null) {
                return Promise.resolve(match);
            }
        }

        const {input} = this.config;

        return input.select({
            message: 'Where do you want to go?',
            options: Object.entries(PageForm.SITEMAP).map(
                ([label, value]) => ({
                    value: value,
                    label: label,
                }),
            ),
        });
    }

    private static findMatch(page: string): string|null {
        if (page.startsWith('/')) {
            return page;
        }

        let match = null;
        let max = 0.5;

        for (const label of Object.keys(PageForm.SITEMAP)) {
            const similarity = stringSimilarity(page, label);

            if (similarity > max) {
                match = PageForm.SITEMAP[label];
                max = similarity;
            }
        }

        return match;
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
