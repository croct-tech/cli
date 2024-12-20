import {graphql} from '@/infrastructure/graphql';

export const experimentsQuery = graphql(`
    query Experiments($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!, $experienceId: ExperienceId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                experience(id: $experienceId) {
                    experiments(first: 100) {
                        edges {
                            node {
                                id,
                                name,
                                crossDevice,
                                goalId,
                                traffic,
                                status,
                                variants {
                                    name,
                                    content {
                                        default {
                                            contents {
                                                slotId,
                                                content,
                                                locale,
                                            }
                                        },
                                        segmented {
                                            groupId,
                                            contents {
                                                slotId,
                                                content,
                                                locale,
                                            },
                                            audiences {
                                                audienceId
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`);

export const experimentQuery = graphql(`
    query Experiment(
        $organizationSlug: ReadableId!,
        $workspaceSlug: ReadableId!,
        $experienceId: ExperienceId!,
        $experimentId: ExperimentId!
    ) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                experience(id: $experienceId) {
                    experiment(id: $experimentId) {
                        id,
                        name,
                        crossDevice,
                        goalId,
                        traffic,
                        status,
                        variants {
                            name,
                            content {
                                default {
                                    contents {
                                        slotId,
                                        content,
                                        locale,
                                    }
                                },
                                segmented {
                                    groupId,
                                    contents {
                                        slotId,
                                        content,
                                        locale,
                                    },
                                    audiences {
                                        audienceId
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`);
