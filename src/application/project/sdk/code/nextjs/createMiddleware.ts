import {namedTypes as Ast} from 'ast-types/gen/namedTypes';
import {builders as builder} from 'ast-types';
import {Codemod, ResultCode} from '@/application/project/sdk/code/codemod';

export class CreateMiddleware implements Codemod<Ast.File> {
    public apply(input: Ast.File): Promise<ResultCode<Ast.File>> {
        const {body} = input.program;

        body.splice(0, body.length);

        body.push(
            builder.exportNamedDeclaration.from({
                declaration: null,
                source: builder.literal('@croct/plug-next/middleware'),
                specifiers: [
                    builder.exportSpecifier.from({
                        exported: builder.identifier('config'),
                        local: builder.identifier('config'),
                    }),
                    builder.exportSpecifier.from({
                        exported: builder.identifier('middleware'),
                        local: builder.identifier('middleware'),
                    }),
                ],
            }),
        );

        return Promise.resolve({
            modified: true,
            result: input,
        });
    }
}
