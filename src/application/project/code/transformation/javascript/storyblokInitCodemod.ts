/* eslint-disable no-param-reassign -- False positives */
import * as t from '@babel/types';
import {traverse} from '@babel/core';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';

export type StoryblokInitCodemodOptions = CodemodOptions & {
    name: string,
    module: string,
};

export class StoryblokInitCodemod implements Codemod<t.File, StoryblokInitCodemodOptions> {
    public apply(input: t.File, options?: StoryblokInitCodemodOptions): Promise<ResultCode<t.File>> {
        if (options === undefined) {
            return Promise.resolve({
                modified: false,
                result: input,
            });
        }

        const localName = getImportLocalName(input, {
            moduleName: /@storyblok\/(js|react)/,
            importName: /storyblokInit|\*/,
        });

        if (localName === null) {
            return Promise.resolve({
                modified: false,
                result: input,
            });
        }

        const importLocalName = options.module !== undefined
            ? getImportLocalName(input, {
                importName: options.name,
                moduleName: options.module,
            })
            : null;

        const wrapperName = importLocalName ?? options.name;
        let modified = false;

        traverse(input, {
            CallExpression: path => {
                const {callee} = path.node;

                const isDirectCall = t.isIdentifier(callee) && callee.name === 'storyblokInit';
                const isMemberCall = t.isMemberExpression(callee)
                    && t.isIdentifier(callee.property)
                    && callee.property.name === 'storyblokInit';

                if (!isDirectCall && !isMemberCall) {
                    return;
                }

                const args = path.node.arguments;

                if (
                    args.length === 1
                    && t.isCallExpression(args[0])
                    && t.isIdentifier(args[0].callee)
                    && args[0].callee.name === wrapperName
                ) {
                    return;
                }

                path.node.arguments = [
                    t.callExpression(
                        t.identifier(wrapperName),
                        args,
                    ),
                ];

                modified = true;
            },
        });

        if (modified && importLocalName === null) {
            const {body} = input.program;

            if (!t.isImportDeclaration(body[0])) {
                body.unshift(t.emptyStatement());
            }

            addImport(input, {
                type: 'value',
                moduleName: options.module,
                importName: options.name,
            });
        }

        return Promise.resolve({
            modified: modified,
            result: input,
        });
    }
}
