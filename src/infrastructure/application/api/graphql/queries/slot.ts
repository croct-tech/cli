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
                                component {
                                    customId
                                    definition {
                                        version {
                                            major
                                            minor
                                        }
                                        metadata {
                                            directReferences
                                            indirectReferences
                                            referenceMetadata {
                                                referenceName
                                                componentId
                                            }
                                        }
                                    }
                                }
                                version {
                                    major
                                    minor
                                }
                                componentDefinition {
                                    resolvedDefinition
                                }
                                default {
                                    content
                                    locale
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
                        component {
                            customId
                            definition {
                                version {
                                    major
                                    minor
                                }
                                metadata {
                                    directReferences
                                    indirectReferences
                                    referenceMetadata {
                                        referenceName
                                        componentId
                                    }
                                }
                            }
                        }
                        version {
                            major
                            minor
                        }
                        componentDefinition {
                            resolvedDefinition
                        }
                        default {
                            content
                            locale
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
