import {graphql} from '@/infrastructure/graphql';

export const componentsQuery = graphql(`
    query Components($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                components(first: 100) {
                    edges {
                        node {
                            id
                            customId
                            name
                            definition {
                                version {
                                    major
                                    minor
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`);

export const componentQuery = graphql(`
    query Component(
        $organizationSlug: ReadableId!,
        $workspaceSlug: ReadableId!,
        $componentSlug: ReadableId!,
        $majorVersion: Int
    ) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                component(customId: $componentSlug) {
                    id
                    customId
                    name
                    definition(majorVersion: $majorVersion) {
                        version {
                            major
                            minor
                        }
                    }
                }
            }
        }
    }
`);
