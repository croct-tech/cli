export enum Expertise {
    DESIGN = 'DESIGN',
    ENGINEERING = 'ENGINEERING',
    MARKETING = 'MARKETING',
    OTHER = 'OTHER',
    PRODUCT = 'PRODUCT'
}

export type User = {
    id: string,
    username: string,
    email: string,
    firstName: string,
    lastName?: string,
    expertise: Expertise,
};
