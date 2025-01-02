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
