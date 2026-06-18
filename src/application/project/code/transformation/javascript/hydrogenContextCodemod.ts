import * as t from '@babel/types';
import {traverse} from '@babel/core';
import {traverseFast} from '@babel/types';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {CodemodError} from '@/application/project/code/transformation/codemod';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';

export type HydrogenContextConfiguration = {
    /**
     * The context factory import to call, e.g. `createCroctContext`.
     */
    factory: {
        moduleName: string,
        importName: string,
        localName?: string,
    },

    /**
     * When true, throw if the load-context factory's return could not be found (instead of a
     * silent no-op), so the SDK can report the failure.
     */
    required?: boolean,
};

type Anchor = {
    request: string,
    context: string,
    returnStatement: t.ReturnStatement,
    returnArgument: t.Expression,
    functionNode: t.Function,
};

/**
 * Exposes the Croct visitor context on the Hydrogen (Remix) load context.
 *
 * Finds the function that builds `const <ctx> = createHydrogenContext(...)` and adds a
 * `croct: await <factory>(<request>, <ctx>)` property to its returned object, where `<request>`
 * is the function's first parameter. Adds the import. Returns unmodified when the anchor is
 * absent or `croct` is already wired.
 */
export class HydrogenContextCodemod implements Codemod<t.File, CodemodOptions> {
    private static readonly FACTORY_NAME = 'createHydrogenContext';

    private static readonly FACTORY_MODULE = '@shopify/hydrogen';

    private static readonly PROPERTY = 'croct';

    private readonly configuration: HydrogenContextConfiguration;

    public constructor(configuration: HydrogenContextConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const anchor = HydrogenContextCodemod.findAnchor(input);

        if (anchor === null) {
            if (this.configuration.required === true) {
                throw new CodemodError('No Hydrogen load context found to expose the Croct context on.');
            }

            return Promise.resolve({modified: false, result: input});
        }

        const {factory} = this.configuration;
        const importedName = getImportLocalName(input, {
            moduleName: factory.moduleName,
            importName: factory.importName,
        });

        if (importedName !== null && HydrogenContextCodemod.callsFactory(anchor.functionNode, importedName)) {
            return Promise.resolve({modified: false, result: input});
        }

        const {returnArgument} = anchor;

        if (t.isObjectExpression(returnArgument) && HydrogenContextCodemod.hasProperty(returnArgument)) {
            return Promise.resolve({modified: false, result: input});
        }

        const {localName} = addImport(input, {
            type: 'value',
            moduleName: factory.moduleName,
            importName: factory.importName,
            localName: factory.localName,
        });

        const property = t.objectProperty(
            t.identifier(HydrogenContextCodemod.PROPERTY),
            t.awaitExpression(
                t.callExpression(t.identifier(localName), [t.identifier(anchor.request), t.identifier(anchor.context)]),
            ),
        );

        if (t.isObjectExpression(returnArgument)) {
            returnArgument.properties.push(property);
        } else {
            anchor.returnStatement.argument = t.objectExpression([t.spreadElement(returnArgument), property]);
        }

        return Promise.resolve({modified: true, result: input});
    }

    private static findAnchor(ast: t.File): Anchor | null {
        const factoryName = getImportLocalName(ast, {
            moduleName: HydrogenContextCodemod.FACTORY_MODULE,
            importName: HydrogenContextCodemod.FACTORY_NAME,
        }) ?? HydrogenContextCodemod.FACTORY_NAME;

        let anchor: Anchor | null = null;

        traverse(ast, {
            VariableDeclarator: path => {
                const {init} = path.node;
                const call = init !== null && t.isAwaitExpression(init) ? init.argument : init;

                if (
                    call === null
                    || !t.isCallExpression(call)
                    || !t.isIdentifier(call.callee)
                    || call.callee.name !== factoryName
                    || !t.isIdentifier(path.node.id)
                ) {
                    return;
                }

                const fn = path.getFunctionParent();

                if (fn === null) {
                    return;
                }

                const [param] = fn.node.params;

                if (param === undefined || !t.isIdentifier(param)) {
                    return;
                }

                const request = param.name;
                const context = path.node.id.name;

                fn.traverse({
                    ReturnStatement: returnPath => {
                        const {argument} = returnPath.node;

                        if (anchor !== null || returnPath.getFunctionParent()?.node !== fn.node || argument === null) {
                            return;
                        }

                        anchor = {
                            request: request,
                            context: context,
                            returnStatement: returnPath.node,
                            returnArgument: argument as t.Expression,
                            functionNode: fn.node,
                        };

                        returnPath.stop();
                    },
                });

                if (anchor !== null) {
                    path.stop();
                }
            },
        });

        return anchor;
    }

    private static callsFactory(node: t.Node, localName: string): boolean {
        let called = false;

        traverseFast(node, current => {
            if (called || !t.isCallExpression(current) || !t.isIdentifier(current.callee)) {
                return;
            }

            called = current.callee.name === localName;
        });

        return called;
    }

    private static hasProperty(object: t.ObjectExpression): boolean {
        return object.properties.some(property => {
            if (!t.isObjectProperty(property) || property.computed) {
                return false;
            }

            const {key} = property;

            return (t.isIdentifier(key) && key.name === HydrogenContextCodemod.PROPERTY)
                || (t.isStringLiteral(key) && key.value === HydrogenContextCodemod.PROPERTY);
        });
    }
}
