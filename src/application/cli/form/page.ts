/* eslint-disable max-len -- Avoid wrapping URLs */
import fuzzysort from 'fuzzysort';
import {Input} from '@/application/cli/io/input';
import {Form} from '@/application/cli/form/form';

export type Configuration = {
    input: Input,
};

export type PageOptions = {
    organizationSlug: string,
    workspaceSlug: string,
    devApplicationSlug: string,
    prodApplicationSlug?: string,
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
        return PageForm.resolvePath(await this.getPage(options.page, options), options);
    }

    private getPage(page: string|undefined, options: PageOptions): Promise<string> {
        if (page !== undefined) {
            const match = PageForm.findMatch(page, options);

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

    private static findMatch(page: string, options: PageOptions): string|null {
        if (page.startsWith('/')) {
            return page;
        }

        let match = null;
        let min = 0;

        for (const label of Object.keys(PageForm.getSitemap(options))) {
            const {score} = fuzzysort.single(page, label) ?? {score: 0};

            if (score > min) {
                match = PageForm.SITEMAP[label];
                min = score;
            }
        }

        return match;
    }

    private static getSitemap(options: PageOptions): Record<string, string> {
        if (options.prodApplicationSlug !== undefined) {
            return PageForm.SITEMAP;
        }

        return Object.fromEntries(
            Object.entries(PageForm.SITEMAP)
                .filter(([, path]) => !path.includes(':prod-application')),
        );
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
                    return options.prodApplicationSlug ?? '';
            }
        });
    }
}
