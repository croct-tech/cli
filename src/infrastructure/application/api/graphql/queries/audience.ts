import {graphql} from '@/infrastructure/graphql';

export const audiencesQuery = graphql(`
    query Audiences($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                audiences(first: 100) {
                    edges {
                        node {
                            id
                            customId
                            name
                            criteria
                        }
                    }
                }
            }
        }
    }
`);

export const audienceQuery = graphql(`
    query Audience(
        $organizationSlug: ReadableId!,
        $workspaceSlug: ReadableId!,
        $audienceSlug: ReadableId!
    ) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                audience(customId: $audienceSlug) {
                    id
                    customId
                    name
                    criteria
                }
            }
        }
    }
`);
