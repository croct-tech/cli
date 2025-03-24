import {graphql} from '@/infrastructure/graphql';

export const workspaceQuery = graphql(`
    query Workspace($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                id
                name
                slug
                logo
                website
                timeZone
                defaultLocale
                locales {
                    edges {
                        node {
                            code
                        }
                    }
                }
            }
        }
    }
`);

export const workspacesQuery = graphql(`
    query Workspaces($organizationSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspaces(first: 100) {
                edges {
                    node {
                        id
                        name
                        slug
                        logo
                        website
                        timeZone
                        defaultLocale
                        locales {
                            edges {
                                node {
                                    code
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`);

export const createWorkspaceMutation = graphql(`
    mutation CreateWorkspace($organizationId: OrganizationId!, $payload: CreateWorkspacePayload!) {
        createWorkspace(organizationId: $organizationId, payload: $payload) {
            id
            name
            slug
            logo
            website
            timeZone
            defaultLocale
            locales {
                edges {
                    node {
                        code
                    }
                }
            }
        }
    }
`);

export const workspaceSlugAvailabilityQuery = graphql(`
    query FindWorkspaceSlug(
        $organizationId: OrganizationId!
        $slugFirstOption: ReadableId!
        $slugSecondOption: ReadableId!
        $slugThirdOption: ReadableId!
    ) {
        checkAvailability {
            slugFirstOption: workspaceSlug(organizationId: $organizationId, slug: $slugFirstOption)
            slugSecondOption: workspaceSlug(organizationId: $organizationId, slug: $slugSecondOption)
            slugThirdOption: workspaceSlug(organizationId: $organizationId, slug: $slugThirdOption)
        }
    }
`);

export const workspaceFeaturesQuery = graphql(`
    query WorkspaceFeatures($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                quotas {
                    audience
                    remainingAudiences
                    component
                    remainingComponents
                    slot
                    remainingSlots,
                    experience
                    remainingExperiences
                    experiment
                    remainingExperiments
                    dynamicAttributesPerContent
                    audiencesPerExperience
                }
                capabilities {
                    features(requiredFeatures: [
                        EXPERIMENT,
                        CROSS_DEVICE_EXPERIMENT,
                        API_DATA_EXPORT
                    ])
                }
            }   
        }
    }
`);

export const createResourcesMutation = graphql(`
    mutation CreateResources($workspaceId: WorkspaceId!, $payload: CreateWorkspaceResourcePayload!) {
        createWorkspaceResources(workspaceId: $workspaceId, payload: $payload) {
            slots
            components
            audiences
            experiences {
                id,
                experimentId
            }
        }
    }
`);
