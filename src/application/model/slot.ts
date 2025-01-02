import {RootDefinition} from '@/application/project/example/content-model/definitions';

export type Slot = {
    id: string,
    name: string,
    slug: string,
    component?: {
        slug: string,
        version: {
            major: number,
            minor: number,
        },
        metadata: {
            directReferences: string[],
            indirectReferences: string[],
        },
    },
    version: {
        major: number,
        minor: number,
    },
    resolvedDefinition: RootDefinition,
};
