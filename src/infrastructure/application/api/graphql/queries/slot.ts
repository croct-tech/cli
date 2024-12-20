import {graphql} from '@/infrastructure/graphql';

export const slotsQuery = graphql(`
    query Slots($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                slots(first: 100) {
                    edges {
                        node {
                            id
                            customId
                            name
                            content {
                                version {
                                    major
                                    minor
                                }
                                componentDefinition {
                                    resolvedDefinition
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`);

export const slotQuery = graphql(`
    query Slot(
        $organizationSlug: ReadableId!,
        $workspaceSlug: ReadableId!,
        $slotSlug: ReadableId!,
        $majorVersion: Int
    ) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                slot(customId: $slotSlug) {
                    id
                    customId
                    name
                    content(majorVersion: $majorVersion) {
                        version {
                            major
                            minor
                        }
                        componentDefinition {
                            resolvedDefinition
                        }
                    }
                }
            }
        }
    }
`);

export const slotStaticContentQuery = graphql(`
    query SlotStaticContent(
        $organizationSlug: ReadableId!,
        $workspaceSlug: ReadableId!,
        $slotSlug: ReadableId!
        $majorVersion: Int
    ) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                slot(customId: $slotSlug) {
                    staticContent(majorVersion: $majorVersion) {
                        locale
                        content
                    }
                }
            }
        }
    }
`);
