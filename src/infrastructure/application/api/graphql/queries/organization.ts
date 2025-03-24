import {graphql} from '@/infrastructure/graphql';

export const resourceIdQuery = graphql(`
    query ResourceIdQuery(
        $organizationSlug: ReadableId!,
        $workspaceSlug: ReadableId,
        $applicationSlug: ReadableId
    ) {
        organization(slug: $organizationSlug) {
            id
            workspace(slug: $workspaceSlug) {
                id
                application(slug: $applicationSlug) {
                    id
                }
            }
        }
    }
`);

export const organizationQuery = graphql(`
    query Organization($slug: ReadableId!) {
        organization(slug: $slug) {
            id
            name
            slug
            type
            website
            logo
            email
        }
    }
`);

export const organizationsQuery = graphql(`
    query Organizations {
        organizations(first: 100) {
            edges {
                node {
                    id
                    name
                    slug
                    type
                    website
                    logo
                    email
                }
            }
        }
    }
`);

export const setupOrganizationMutation = graphql(`
    mutation SetupOrganization($payload: CreateConfiguredOrganizationPayload!) {
        createConfiguredOrganization(payload: $payload) {
            organization {
                id
                name
                slug
                type
                website
                logo
                email
            }
        }
    }
`);

export const organizationSlugAvailabilityQuery = graphql(`
    query FindOrganizationSlug(
        $slugFirstOption: ReadableId!
        $slugSecondOption: ReadableId!
        $slugThirdOption: ReadableId!
    ) {
        checkAvailability {
            slugFirstOption: organizationSlug(slug: $slugFirstOption)
            slugSecondOption: organizationSlug(slug: $slugSecondOption)
            slugThirdOption: organizationSlug(slug: $slugThirdOption)
        }
    }
`);

export const websiteMetadataQuery = graphql(`
    query OrganizationMetadata($url: String!) {
        websiteMetadata(url: $url){
            url
            siteName
            domain
            languages
            platform
            technologies {
                name
            }
            logo {
                data
                height
                width
            }
        }
    }
`);
