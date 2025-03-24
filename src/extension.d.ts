import {RootDefinition as ContentDefinition} from '@croct/content-model/definition/definition';

declare global {
    namespace ContentModel {
        type RootDefinition = ContentDefinition;
    }
}

export {};
