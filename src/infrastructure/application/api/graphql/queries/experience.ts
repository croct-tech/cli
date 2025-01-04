import {graphql} from '@/infrastructure/graphql';

export const experienceQuery = graphql(`
    query Experience(
        $organizationSlug: ReadableId!,
        $workspaceSlug: ReadableId!,
        $experienceId: ExperienceId!
    ) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                experience(id: $experienceId) {
                    id,
                    name,
                    priority,
                    status,
                    hasExperiments,
                    currentExperiment {
                        id,
                        name,
                        crossDevice,
                        goalId,
                        traffic,
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
                    draft {
                        priority,
                        audiences {
                            id,
                            customId,
                        },
                        slots {
                            slot {
                                id,
                                customId,
                            }
                            version {
                                minor,
                                major
                            }
                        },
                        timeZone,
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
                        },
                        experiment {
                            name,
                            crossDevice,
                            goalId,
                            traffic,
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
                    settings {
                        content {
                            default {
                                contents {
                                    slotId
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
                        audiences {
                            id,
                            customId,
                        }
                        slots {
                            slot {
                                id,
                                customId,
                            }
                            version {
                                minor,
                                major
                            }
                        }
                    }
                }
            }
        }
    }
`);

export const experiencesQuery = graphql(`
    query Experiences($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!, $status: [ExperienceStatus!]) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                experiences(first: 100, status: $status) {
                    edges {
                        node {
                            id,
                            name,
                            priority,
                            status,
                            currentExperiment {
                                name,
                            },
                            draft {
                                priority,
                                audiences {
                                    id,
                                    customId,
                                },
                                slots {
                                    slot {
                                        id,
                                        customId,
                                    }
                                    version {
                                        minor,
                                        major
                                    }
                                },
                                experiment {
                                    name,
                                }
                            }
                            settings {
                                audiences {
                                    id,
                                    customId
                                }
                                slots {
                                    slot {
                                        id,
                                        customId
                                    }
                                    version {
                                        minor,
                                        major
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
