import * as t from '@babel/types';
import {traverse} from '@babel/core';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import {spreadAsArray} from '@/application/project/code/transformation/javascript/utils/spreadAsArray';

export type HydrogenCspConfiguration = {
    /**
     * The origin the browser SDK must be allowed to reach, e.g. `https://api.croct.io`.
     */
    origin: string,
};

/**
 * Allows the Croct origin in Hydrogen's Content Security Policy.
 *
 * Adds the origin to the `connectSrc` array of the options object passed to
 * `createContentSecurityPolicy(...)`, creating the directive when missing and normalizing a
 * non-array value into one. The function import is resolved so aliased imports are matched. Returns
 * unmodified when the call or its options object is absent or when the origin is already present.
 */
export class HydrogenCspCodemod implements Codemod<t.File, CodemodOptions> {
    private static readonly FUNCTION_NAME = 'createContentSecurityPolicy';

    private static readonly FUNCTION_MODULE = '@shopify/hydrogen';

    private static readonly DIRECTIVE = 'connectSrc';

    private readonly configuration: HydrogenCspConfiguration;

    public constructor(configuration: HydrogenCspConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const options = HydrogenCspCodemod.findOptionsObject(input);

        if (options === null) {
            return Promise.resolve({modified: false, result: input});
        }

        const {origin} = this.configuration;
        const directive = HydrogenCspCodemod.findProperty(options, HydrogenCspCodemod.DIRECTIVE);

        if (directive === null) {
            options.properties.push(
                t.objectProperty(
                    t.identifier(HydrogenCspCodemod.DIRECTIVE),
                    t.arrayExpression([t.stringLiteral(origin)]),
                ),
            );

            return Promise.resolve({modified: true, result: input});
        }

        if (!t.isArrayExpression(directive.value)) {
            // Normalize a non-array directive (a variable, a call, etc.) into an array with the
            // origin, preserving the existing value. The cast is forced by `ObjectProperty.value`'s
            // `Expression | PatternLike` type; an object-literal value is always an expression.
            directive.value = t.arrayExpression([
                spreadAsArray(directive.value as t.Expression),
                t.stringLiteral(origin),
            ]);

            return Promise.resolve({modified: true, result: input});
        }

        const array = directive.value;

        if (HydrogenCspCodemod.hasValue(array, origin)) {
            return Promise.resolve({modified: false, result: input});
        }

        array.elements.push(t.stringLiteral(origin));

        return Promise.resolve({modified: true, result: input});
    }

    private static findOptionsObject(ast: t.File): t.ObjectExpression | null {
        const functionName = getImportLocalName(ast, {
            moduleName: HydrogenCspCodemod.FUNCTION_MODULE,
            importName: HydrogenCspCodemod.FUNCTION_NAME,
        }) ?? HydrogenCspCodemod.FUNCTION_NAME;

        let options: t.ObjectExpression | null = null;

        traverse(ast, {
            CallExpression: path => {
                if (!t.isIdentifier(path.node.callee) || path.node.callee.name !== functionName) {
                    return;
                }

                const [argument] = path.node.arguments;

                if (argument !== undefined && t.isObjectExpression(argument)) {
                    options = argument;

                    path.stop();
                }
            },
        });

        return options;
    }

    private static hasValue(array: t.ArrayExpression, value: string): boolean {
        return array.elements.some(
            element => element !== null && t.isStringLiteral(element) && element.value === value,
        );
    }

    private static findProperty(object: t.ObjectExpression, name: string): t.ObjectProperty | null {
        for (const property of object.properties) {
            if (!t.isObjectProperty(property) || property.computed) {
                continue;
            }

            const {key} = property;

            if ((t.isIdentifier(key) && key.name === name) || (t.isStringLiteral(key) && key.value === name)) {
                return property;
            }
        }

        return null;
    }
}
