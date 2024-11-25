import {RootDefinition as ComponentDefinition} from '@/application/project/example/content-model/definitions';

declare global {
    namespace ContentModel {
        type RootDefinition = ComponentDefinition;
    }
}
