import {JsonValue} from '@croct/json';
import {JsonCompositeNode} from '@/infrastructure/json/node/compositeNode';

export abstract class JsonValueNode extends JsonCompositeNode {
    public abstract update(other: JsonValueNode|JsonValue, merge?: boolean): JsonValueNode;

    public abstract toJSON(): JsonValue;
}
