export type Component = {
    id: string,
    name: string,
    slug: string,
    version: {
        major: number,
        minor: number,
    },
    metadata: {
        directReferences: string[],
        indirectReferences: string[],
    },
};
