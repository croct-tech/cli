import {graphql} from '@/infrastructure/graphql';

export const applicationSlugAvailabilityQuery = graphql(`
    query ApplicationSlugAvailability(
        $workspaceId: WorkspaceId!
        $slugFirstOption: ReadableId!
        $slugSecondOption: ReadableId!
        $slugThirdOption: ReadableId!
    ) {
        checkAvailability {
            slugFirstOption: applicationSlug(workspaceId: $workspaceId, slug: $slugFirstOption)
            slugSecondOption: applicationSlug(workspaceId: $workspaceId, slug: $slugSecondOption)
            slugThirdOption: applicationSlug(workspaceId: $workspaceId, slug: $slugThirdOption)
        }
    }
`);

export const applicationsQuery = graphql(`
    query Applications($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                applications(first: 100) {
                    edges {
                        node {
                            id
                            publicId
                            name
                            slug
                            logo
                            website
                            environment
                            platform
                            applicationStatus
                            settings {
                                timeZone
                            }
                        }
                    }
                }
            }
        }
    }
`);

export const applicationQuery = graphql(`
    query Application($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!, $applicationSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                application(slug: $applicationSlug) {
                    id
                    publicId
                    name
                    slug
                    logo
                    website
                    environment
                    platform
                    applicationStatus
                    settings {
                        timeZone
                    }
                }
            }
        }
    }
`);

export const createApplicationMutation = graphql(`
    mutation CreateApplication($workspaceId: WorkspaceId!, $payload: CreateWebApplicationPayload!) {
        createWebApplication(workspaceId: $workspaceId, payload: $payload) {
            id
            publicId
            name
            slug
            logo
            website
            environment
            platform
            applicationStatus
            settings {
                timeZone
            }
        }
    }
`);

export const createApiKeyMutation = graphql(`
    mutation CreateApiKey($applicationId: ApplicationId!, $payload: CreateApiKeyPayload!) {
        createApiKey(applicationId: $applicationId, payload: $payload) {
            apiKey {
                id
                name
                permissions
            }
            apiKeyValue
        }
    }
`);
