import {RootDefinition} from '@/application/project/example/content-model/definitions';
import {ExampleGenerator} from '@/application/project/example/example';

export type SlotDefinition = {
    id: string,
    version: number,
    definition: RootDefinition,
};

export interface SlotExampleGenerator extends ExampleGenerator<SlotDefinition> {
}
