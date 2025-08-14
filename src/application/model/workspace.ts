export type Workspace = {
    id: string,
    name: string,
    logo?: string,
    slug: string,
    defaultLocale: string,
    locales: string[],
    timeZone: string,
    website?: string,
};

export type WorkspaceFeatures = {
    quotas: {
        audiences: number,
        remainingAudiences: number,
        components: number,
        remainingComponents: number,
        slots: number,
        remainingSlots: number,
        experiences: number,
        remainingExperiences: number,
        dynamicAttributesPerContent: number,
        audiencesPerExperience: number,
    },
    features: {
        crossDevice: boolean,
        dataExport: boolean,
    },
};
