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
        audience: number,
        remainingAudiences: number,
        component: number,
        remainingComponents: number,
        slot: number,
        remainingSlots: number,
        experience: number,
        remainingExperiences: number,
        experiment: number,
        remainingExperiments: number,
        dynamicAttributesPerContent: number,
        audiencesPerExperience: number,
    },
    features: {
        crossDevice: boolean,
        dataExport: boolean,
    },
};
