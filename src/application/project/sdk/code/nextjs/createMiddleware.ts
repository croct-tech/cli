import {namedTypes as Ast} from 'ast-types/gen/namedTypes';
import {builders as builder} from 'ast-types';
import {Codemod, ResultCode} from '@/application/project/sdk/code/codemod';
import {hasReexport} from '@/application/project/sdk/code/javascript/hasReexport';

export class CreateMiddleware implements Codemod<Ast.File> {
    public apply(input: Ast.File): Promise<ResultCode<Ast.File>> {
        const {body} = input.program;
        const exports: Ast.ExportSpecifier[] = [];

        if (!CreateMiddleware.hasReexport(input, '@croct/plug-next/middleware', 'config')) {
            exports.push(
                builder.exportSpecifier.from({
                    exported: builder.identifier('config'),
                    local: builder.identifier('config'),
                }),
            );
        }

        if (!CreateMiddleware.hasReexport(input, '@croct/plug-next/middleware', 'middleware')) {
            exports.push(
                builder.exportSpecifier.from({
                    exported: builder.identifier('middleware'),
                    local: builder.identifier('middleware'),
                }),
            );
        }

        if (exports.length > 0) {
            body.push(
                builder.exportNamedDeclaration.from({
                    declaration: null,
                    source: builder.literal('@croct/plug-next/middleware'),
                    specifiers: exports,
                }),
            );
        }

        return Promise.resolve({
            modified: true,
            result: input,
        });
    }

    private static hasReexport(input: Ast.File, moduleName: string, importName: string): boolean {
        return hasReexport(input, {
            moduleName: moduleName,
            importName: importName,
        });
    }
}
