export enum OrganizationType {
    PERSONAL = 'PERSONAL',
    BUSINESS = 'BUSINESS',
}

export type Organization = {
    type: OrganizationType,
    id: string,
    slug: string,
    name: string,
    email: string,
    logo?: string,
    website?: string,
};
