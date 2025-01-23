import {RootDefinition} from '@croct/content-model/definition/definition';
import {LocalizedContentMap} from '@/application/model/experience';

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
    content: LocalizedContentMap,
};
