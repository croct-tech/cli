import type {RootDefinition} from '@croct/content-model/definition/definition';
import type {ExampleGenerator} from '@/application/project/code/generation/example';

export type SlotDefinition = {
    id: string,
    version: number,
    definition: RootDefinition,
};

export interface SlotExampleGenerator extends ExampleGenerator<SlotDefinition> {
}
