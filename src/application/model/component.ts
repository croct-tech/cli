import {RootDefinition} from '@croct/content-model/definition/definition';

export type Component = {
    id: string,
    name: string,
    slug: string,
    version: {
        major: number,
        minor: number,
    },
    definition: RootDefinition,
    metadata: {
        directReferences: string[],
        indirectReferences: string[],
    },
};
