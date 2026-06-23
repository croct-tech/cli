import * as t from '@babel/types';

/**
 * Builds a spread that flattens a value as an array: `...(Array.isArray(value) ? value : [value])`.
 *
 * Lets a codemod append to a list whose current value may not be an array literal (a variable, a
 * call, etc.) while preserving it, whether it is a single item or already an array. Pass an
 * identifier (e.g. a hoisted constant) when the value has side effects to avoid evaluating it twice.
 */
export function spreadAsArray(value: t.Expression): t.SpreadElement {
    return t.spreadElement(
        t.conditionalExpression(
            t.callExpression(
                t.memberExpression(t.identifier('Array'), t.identifier('isArray')),
                [t.cloneNode(value)],
            ),
            t.cloneNode(value),
            t.arrayExpression([t.cloneNode(value)]),
        ),
    );
}
