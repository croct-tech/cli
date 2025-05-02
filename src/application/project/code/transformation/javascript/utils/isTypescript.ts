import {File, Node, isTypeScript, isImportDeclaration, isImportSpecifier} from '@babel/types';
import {traverse} from '@babel/core';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';

export function isTypescript(source: string | File): boolean {
    const ast = typeof source === 'string'
        ? parse(source, ['jsx', 'typescript'])
        : source;

    let matched = false;

    traverse(ast, {
        enter: path => {
            const {node} = path;

            if (isTypeScriptNode(node)) {
                matched = true;

                return path.stop();
            }
        },
    });

    return matched;
}

function isTypeScriptNode(node: Node): boolean {
    return isTypeScript(node) || isTypeImport(node);
}

function isTypeImport(node: Node): boolean {
    return (isImportSpecifier(node) || isImportDeclaration(node))
      && (node.importKind === 'type' || node.importKind === 'typeof');
}
