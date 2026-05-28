import * as t from '@babel/types';
import {traverse} from '@babel/core';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import type {AttributeType} from '@/application/project/code/transformation/javascript/utils/createObjectProps';
import {createPropsObject} from '@/application/project/code/transformation/javascript/utils/createObjectProps';

type ChainCall = t.CallExpression & {callee: t.MemberExpression};

type ChainAnchor = {
    kind: 'chain',
    mountCall: ChainCall,
};

type VariableAnchor = {
    kind: 'variable',
    binding: string,
    parentBody: t.Statement[],
    declarationStatement: t.Node,
    mountStatement: t.ExpressionStatement,
};

export type MountAnchor = ChainAnchor | VariableAnchor;

type CreateAppMatch = {
    call: t.CallExpression,
    parents: t.Node[],
};

export type VuePluginConfiguration = {
    plugin: {
        module: string,
        factory: string,
    },
    args?: Record<string, AttributeType>,
};

export type VuePluginOptions = CodemodOptions & {
    args?: Record<string, AttributeType>,
};

/**
 * Registers a Vue plugin in the main entry file.
 *
 * Inserts the plugin registration just before app.mount, preserving whichever
 * form the user wrote (chained or variable). If the plugin is already
 * registered, the codemod returns unmodified.
 */
export class VuePluginCodemod implements Codemod<t.File, VuePluginOptions> {
    private readonly configuration: VuePluginConfiguration;

    public constructor(configuration: VuePluginConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File, options: VuePluginOptions = {}): Promise<ResultCode<t.File>> {
        const anchor = VuePluginCodemod.findMountAnchor(input);

        if (anchor === null) {
            return Promise.resolve({modified: false, result: input});
        }

        const {plugin} = this.configuration;
        const args = options.args ?? this.configuration.args;

        const factoryLocal = getImportLocalName(input, {
            moduleName: plugin.module,
            importName: plugin.factory,
        });

        if (factoryLocal !== null && VuePluginCodemod.hasFactoryCall(anchor, factoryLocal)) {
            return Promise.resolve({modified: false, result: input});
        }

        const factoryImport = addImport(input, {
            type: 'value',
            moduleName: plugin.module,
            importName: plugin.factory,
        });

        const factoryCall = t.callExpression(
            t.identifier(factoryImport.localName),
            args === undefined ? [] : [createPropsObject(args)],
        );

        if (anchor.kind === 'chain') {
            VuePluginCodemod.injectIntoChain(anchor, factoryCall);
        } else {
            VuePluginCodemod.injectBeforeMount(anchor, factoryCall);
        }

        return Promise.resolve({modified: true, result: input});
    }

    public static findMountAnchor(ast: t.File): MountAnchor | null {
        const createAppName = getImportLocalName(ast, {
            moduleName: 'vue',
            importName: 'createApp',
        });

        if (createAppName === null) {
            return null;
        }

        const match = VuePluginCodemod.findCreateAppCall(ast, createAppName);

        if (match === null) {
            return null;
        }

        return VuePluginCodemod.matchChainAnchor(match) ?? VuePluginCodemod.matchVariableAnchor(match);
    }

    public static hasFactoryCall(anchor: MountAnchor, factoryLocal: string): boolean {
        return anchor.kind === 'chain'
            ? VuePluginCodemod.chainHasFactoryCall(anchor, factoryLocal)
            : VuePluginCodemod.variableBodyHasFactoryCall(anchor, factoryLocal);
    }

    public static findUseCall(anchor: MountAnchor, identifier: string): t.CallExpression | null {
        return anchor.kind === 'chain'
            ? VuePluginCodemod.findUseCallInChain(anchor, identifier)
            : VuePluginCodemod.findUseCallInBody(anchor, identifier);
    }

    private static findCreateAppCall(ast: t.File, createAppName: string): CreateAppMatch | null {
        let match: CreateAppMatch | null = null;

        traverse(ast, {
            CallExpression: path => {
                const {node} = path;

                if (!t.isIdentifier(node.callee) || node.callee.name !== createAppName) {
                    return;
                }

                const parents: t.Node[] = [];
                let current: typeof path.parentPath | null = path.parentPath;

                while (current !== null) {
                    parents.push(current.node);
                    current = current.parentPath;
                }

                match = {
                    call: node,
                    parents: parents,
                };

                path.stop();
            },
        });

        return match;
    }

    private static matchChainAnchor(match: CreateAppMatch): ChainAnchor | null {
        return VuePluginCodemod.walkChain(match.call, match.parents, 0);
    }

    private static walkChain(inner: t.Node, parents: t.Node[], index: number): ChainAnchor | null {
        const memberNode = parents[index];

        if (
            memberNode === undefined
            || !t.isMemberExpression(memberNode)
            || memberNode.object !== inner
            || memberNode.computed
            || !t.isIdentifier(memberNode.property)
        ) {
            return null;
        }

        const callNode = parents[index + 1];

        if (
            callNode === undefined
            || !VuePluginCodemod.isChainCall(callNode)
            || callNode.callee !== memberNode
        ) {
            return null;
        }

        if (memberNode.property.name === 'mount') {
            return {
                kind: 'chain',
                mountCall: callNode,
            };
        }

        return VuePluginCodemod.walkChain(callNode, parents, index + 2);
    }

    private static matchVariableAnchor(match: CreateAppMatch): VariableAnchor | null {
        const [declaratorNode, declarationNode, containerNode] = match.parents;

        if (!t.isVariableDeclarator(declaratorNode) || declaratorNode.init !== match.call) {
            return null;
        }

        if (!t.isIdentifier(declaratorNode.id)) {
            return null;
        }

        const parentBody = VuePluginCodemod.extractStatementBody(containerNode);

        if (parentBody === null) {
            return null;
        }

        const declarationIndex = parentBody.findIndex(statement => statement === declarationNode);
        const binding = declaratorNode.id.name;
        const mountStatement = VuePluginCodemod.findMountStatement(parentBody, binding, declarationIndex + 1);

        if (mountStatement === null) {
            return null;
        }

        return {
            kind: 'variable',
            binding: binding,
            parentBody: parentBody,
            declarationStatement: declarationNode,
            mountStatement: mountStatement,
        };
    }

    private static extractStatementBody(container: t.Node | undefined): t.Statement[] | null {
        if (
            container !== undefined
            && (t.isProgram(container) || t.isBlockStatement(container) || t.isStaticBlock(container))
        ) {
            return container.body;
        }

        return null;
    }

    private static findMountStatement(
        body: t.Statement[],
        binding: string,
        from: number,
    ): t.ExpressionStatement | null {
        for (let i = from; i < body.length; i++) {
            const statement = body[i];

            if (!t.isExpressionStatement(statement) || !t.isCallExpression(statement.expression)) {
                continue;
            }

            const {callee} = statement.expression;

            if (!t.isMemberExpression(callee) || callee.computed) {
                continue;
            }

            if (!t.isIdentifier(callee.object) || callee.object.name !== binding) {
                continue;
            }

            if (!t.isIdentifier(callee.property) || callee.property.name !== 'mount') {
                continue;
            }

            return statement;
        }

        return null;
    }

    private static isChainCall(node: t.Node): node is ChainCall {
        return t.isCallExpression(node) && t.isMemberExpression(node.callee);
    }

    private static chainHasFactoryCall(anchor: ChainAnchor, factoryLocal: string): boolean {
        let {object} = anchor.mountCall.callee;

        while (VuePluginCodemod.isChainCall(object)) {
            if (
                t.isIdentifier(object.callee.property)
                && object.callee.property.name === 'use'
                && VuePluginCodemod.isFactoryInvocation(object.arguments[0], factoryLocal)
            ) {
                return true;
            }

            object = object.callee.object;
        }

        return false;
    }

    private static variableBodyHasFactoryCall(anchor: VariableAnchor, factoryLocal: string): boolean {
        for (const useCall of VuePluginCodemod.iterateUseCalls(anchor)) {
            if (VuePluginCodemod.isFactoryInvocation(useCall.arguments[0], factoryLocal)) {
                return true;
            }
        }

        return false;
    }

    private static findUseCallInChain(anchor: ChainAnchor, identifier: string): t.CallExpression | null {
        let current: t.Node = anchor.mountCall.callee.object;

        while (VuePluginCodemod.isChainCall(current)) {
            if (
                t.isIdentifier(current.callee.property)
                && current.callee.property.name === 'use'
                && VuePluginCodemod.isFirstArgNamed(current.arguments, identifier)
            ) {
                return current;
            }

            current = current.callee.object;
        }

        return null;
    }

    private static findUseCallInBody(anchor: VariableAnchor, identifier: string): t.CallExpression | null {
        for (const useCall of VuePluginCodemod.iterateUseCalls(anchor)) {
            if (VuePluginCodemod.isFirstArgNamed(useCall.arguments, identifier)) {
                return useCall;
            }
        }

        return null;
    }

    private static* iterateUseCalls(anchor: VariableAnchor): IterableIterator<t.CallExpression> {
        let yielding = false;

        for (const statement of anchor.parentBody) {
            if (statement === anchor.mountStatement) {
                return;
            }

            if (!yielding) {
                if (statement === anchor.declarationStatement) {
                    yielding = true;
                }

                continue;
            }

            if (!t.isExpressionStatement(statement) || !t.isCallExpression(statement.expression)) {
                continue;
            }

            const {callee} = statement.expression;

            if (!t.isMemberExpression(callee) || callee.computed) {
                continue;
            }

            if (!t.isIdentifier(callee.object) || callee.object.name !== anchor.binding) {
                continue;
            }

            if (!t.isIdentifier(callee.property) || callee.property.name !== 'use') {
                continue;
            }

            yield statement.expression;
        }
    }

    private static isFactoryInvocation(node: t.Node | undefined, factoryLocal: string): boolean {
        return node !== undefined
            && t.isCallExpression(node)
            && t.isIdentifier(node.callee)
            && node.callee.name === factoryLocal;
    }

    private static isFirstArgNamed(args: t.Node[], identifier: string): boolean {
        const [first] = args;

        return first !== undefined && t.isIdentifier(first) && first.name === identifier;
    }

    private static injectIntoChain(anchor: ChainAnchor, factoryCall: t.CallExpression): void {
        const {mountCall} = anchor;
        const receiver = mountCall.callee.object;

        mountCall.callee.object = t.callExpression(
            t.memberExpression(receiver, t.identifier('use')),
            [factoryCall],
        );
    }

    private static injectBeforeMount(anchor: VariableAnchor, factoryCall: t.CallExpression): void {
        const useStatement = t.expressionStatement(
            t.callExpression(
                t.memberExpression(t.identifier(anchor.binding), t.identifier('use')),
                [factoryCall],
            ),
        );

        const mountIndex = anchor.parentBody.findIndex(statement => statement === anchor.mountStatement);

        anchor.parentBody.splice(mountIndex, 0, useStatement);
    }
}
