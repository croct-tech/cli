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
                    draft {
                        id,
                        priority,
                        audiences {
                            customId,
                        },
                        slots {
                            slotId,
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
                        }
                        slots {
                            slotId,
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
    query Experiences($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                experiences(first: 100) {
                    edges {
                        node {
                            id,
                            name,
                            priority,
                            status,
                            hasExperiments,
                            draft {
                                id,
                                priority,
                                audiences {
                                    customId,
                                },
                                slots {
                                    slotId,
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
                                    id
                                }
                                slots {
                                    slotId,
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
