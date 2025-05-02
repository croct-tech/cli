import {File, Comment, noop} from '@babel/types';
import type {VisitNodeObject, Node} from '@babel/traverse';
import {transformFromAstAsync, createConfigItem} from '@babel/core';
import bts from '@babel/plugin-transform-typescript';
import bsd from '@babel/plugin-syntax-decorators';
import {Codemod, ResultCode} from '@/application/project/code/transformation/codemod';
import {isTypescript} from '@/application/project/code/transformation/javascript/utils/isTypescript';

export type TypeErasureCodemodOptions = Record<string, never>;

export class TypeErasureCodemod implements Codemod<File, TypeErasureCodemodOptions> {
    public async apply(file: File): Promise<ResultCode<File>> {
        if (!isTypescript(file)) {
            return {
                modified: false,
                result: file,
            };
        }

        const babelTsTransform = createConfigItem([bts, {onlyRemoveTypeImports: true}]);
        const babelDecoratorSyntax = createConfigItem([bsd, {legacy: true}]);

        // When removing TS-specific constructs (e.g., interfaces),
        // ensure that any comments associated with those constructs are also removed.
        // Otherwise, leftover comments might reference nonexistent code.
        const removeComments: VisitNodeObject<unknown, Node> = {
            enter: function visit(nodePath) {
                const leadingComments = nodePath.node.leadingComments ?? nodePath.node.innerComments ?? null;

                if (leadingComments === null) {
                    return;
                }

                const preservedComments: Comment[] = [];

                for (const comment of leadingComments) {
                    const tokens = comment.loc?.tokens ?? [];
                    const tokenIndex = tokens.findIndex(
                        candidate => (
                            candidate.loc?.start === comment.loc?.start
                            && candidate.loc?.end === comment.loc?.end
                        ),
                    );

                    if (tokenIndex >= 0 && tokenIndex < tokens.length - 1) {
                        const commentToken = tokens[tokenIndex];
                        const nextToken = tokens.find(
                            (candidate, index) => (
                                index > tokenIndex
                                && !['CommentLine', 'CommentBlock'].includes(candidate.type)
                            ),
                        );

                        if (nextToken === undefined) {
                            continue;
                        }

                        const difference = nextToken.loc.start.line - commentToken.loc.end.line;

                        if (difference > 1) {
                            preservedComments.push(comment);
                        }
                    }
                }

                if (preservedComments.length > 0) {
                    const node = noop();

                    node.comments = preservedComments;

                    nodePath.insertBefore(node);
                }
            },
        };

        const result = await transformFromAstAsync(file, undefined, {
            plugins: [
                {
                    name: 'comment-remover',
                    visitor: {
                        Program: removeComments,
                        TSTypeAliasDeclaration: removeComments,
                        TSInterfaceDeclaration: removeComments,
                        TSDeclareFunction: removeComments,
                        TSDeclareMethod: removeComments,
                        TSImportType: removeComments,
                        TSModuleDeclaration: removeComments,
                    },
                },
                babelTsTransform,
                babelDecoratorSyntax,
            ],
            ast: true,
            configFile: false,
        });

        return {
            result: result?.ast ?? file,
            modified: (result?.ast ?? null) !== null,
        };
    }
}
