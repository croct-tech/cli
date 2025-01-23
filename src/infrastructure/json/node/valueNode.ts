import {JsonValue} from '@croct/json';
import {JsonCompositeNode} from '@/infrastructure/json/node/compositeNode';

export abstract class JsonValueNode extends JsonCompositeNode {
    public abstract update(other: JsonValueNode|JsonValue, merge?: boolean): JsonValueNode;

    public cast<T extends JsonValueNode>(type: new (definition: any) => T): T {
        if (!(this instanceof type)) {
            throw new Error(`Expected value of type ${type.name} but got ${this.constructor.name}`);
        }

        return this as T;
    }

    public abstract toJSON(): JsonValue;
}
