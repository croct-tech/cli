import {RootDefinition} from '@croct/content-model/definition/definition';
import {ExampleGenerator} from '@/application/project/example/example';

export type SlotDefinition = {
    id: string,
    version: number,
    definition: RootDefinition,
};

export interface SlotExampleGenerator extends ExampleGenerator<SlotDefinition> {
}
