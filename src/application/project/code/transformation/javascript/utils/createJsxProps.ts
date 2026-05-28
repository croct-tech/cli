import * as t from '@babel/types';
import {buildPropertyExpression} from '@/application/project/code/transformation/javascript/utils/createObjectProps';
import type {AttributeType} from '@/application/project/code/transformation/javascript/utils/createObjectProps';

export type {AttributeType} from '@/application/project/code/transformation/javascript/utils/createObjectProps';

export function createJsxAttributes(attributes: Record<string, AttributeType>): t.JSXAttribute[] {
    const nodes: t.JSXAttribute[] = [];

    for (const [key, value] of Object.entries(attributes)) {
        nodes.push(
            t.jsxAttribute(
                t.jsxIdentifier(key),
                t.jsxExpressionContainer(buildPropertyExpression(value)),
            ),
        );
    }

    return nodes;
}
