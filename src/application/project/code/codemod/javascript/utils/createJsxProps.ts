import * as t from '@babel/types';

type PropertyTypes = {
    reference: {
        path: string[],
    },
    literal: {
        value: string | number | boolean | null,
    },
    comparison: {
        left: AttributeType,
        operator: '===' | '!==' | '>' | '>=' | '<' | '<=',
        right: AttributeType,
    },
    ternary: {
        condition: {
            left: AttributeType,
            operator: '===' | '!==' | '>' | '>=' | '<' | '<=',
            right: AttributeType,
        },
        consequent: AttributeType,
        alternate: AttributeType,
    },
};

export type AttributeType = {
    [K in keyof PropertyTypes]: PropertyTypes[K] & {type: K}
}[keyof PropertyTypes];

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

function buildPropertyExpression(attribute: AttributeType): t.Expression {
    switch (attribute.type) {
        case 'reference':
            if (attribute.path.length < 2) {
                return t.identifier(attribute.path[0]);
            }

            return attribute.path
                .slice(2)
                .reduce(
                    (object, key) => t.memberExpression(object, t.identifier(key)),
                    t.memberExpression(
                        t.identifier(attribute.path[0]),
                        t.identifier(attribute.path[1]),
                    ),
                );

        case 'literal':
            if (typeof attribute.value === 'string') {
                return t.stringLiteral(attribute.value);
            }

            if (typeof attribute.value === 'number') {
                return t.numericLiteral(attribute.value);
            }

            if (typeof attribute.value === 'boolean') {
                return t.booleanLiteral(attribute.value);
            }

            return t.nullLiteral();

        case 'comparison':
            return t.binaryExpression(
                attribute.operator,
                buildPropertyExpression(attribute.left),
                buildPropertyExpression(attribute.right),
            );

        case 'ternary':
            return t.conditionalExpression(
                t.binaryExpression(
                    attribute.condition.operator,
                    buildPropertyExpression(attribute.condition.left),
                    buildPropertyExpression(attribute.condition.right),
                ),
                buildPropertyExpression(attribute.consequent),
                buildPropertyExpression(attribute.alternate),
            );
    }
}
