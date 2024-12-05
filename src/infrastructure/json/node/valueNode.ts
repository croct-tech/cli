import {JsonValue} from '@croct/json';
import {JsonCompositeNode} from '@/infrastructure/json/node/compositeNode';

export abstract class JsonValueNode extends JsonCompositeNode {
    public abstract merge(other: JsonValueNode|JsonValue): JsonValueNode;

    public abstract toJSON(): JsonValue;
}
