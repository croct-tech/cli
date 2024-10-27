import {JsonValue} from '@croct/json';
import {JsonTreeNode} from '@/infrastructure/json/node/treeNode';

export abstract class JsonValueNode extends JsonTreeNode {
    public abstract toJSON(): JsonValue;
}
