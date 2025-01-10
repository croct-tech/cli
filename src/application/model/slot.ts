import {RootDefinition} from '@croct/content-model/definition/definition';
import {Content} from '@croct/content-model/content/content';

export type LocalizedSlotContent = Record<string, Content<'structure'>>;

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
    content: LocalizedSlotContent,
};
