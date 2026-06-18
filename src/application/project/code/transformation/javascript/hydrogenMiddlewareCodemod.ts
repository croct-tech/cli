import * as t from '@babel/types';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';
import {spreadAsArray} from '@/application/project/code/transformation/javascript/utils/spreadAsArray';

export type HydrogenMiddlewareConfiguration = {
    /**
     * The middleware factory import to register, e.g. `createCroctMiddleware`.
     */
    middleware: {
        moduleName: string,
        importName: string,
        localName?: string,
    },
};

type Match = {
    declarator: t.VariableDeclarator,
    index: number,
};

/**
 * Registers the Croct middleware in the Hydrogen (React Router 7) root route.
 */
export class HydrogenMiddlewareCodemod implements Codemod<t.File, CodemodOptions> {
    private static readonly EXPORT_NAME = 'middleware';

    private static readonly EXISTING_NAME = 'existingMiddleware';

    private readonly configuration: HydrogenMiddlewareConfiguration;

    public constructor(configuration: HydrogenMiddlewareConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const {middleware} = this.configuration;
        const match = HydrogenMiddlewareCodemod.findDeclarator(input);
        const array = match === null
            ? HydrogenMiddlewareCodemod.createExport(input)
            : HydrogenMiddlewareCodemod.resolveArray(input, match);

        const importedName = getImportLocalName(input, {
            moduleName: middleware.moduleName,
            importName: middleware.importName,
        });

        if (importedName !== null && HydrogenMiddlewareCodemod.hasCall(array, importedName)) {
            return Promise.resolve({modified: false, result: input});
        }

        const {localName} = addImport(input, {
            type: 'value',
            moduleName: middleware.moduleName,
            importName: middleware.importName,
            localName: middleware.localName,
        });

        array.elements.push(t.callExpression(t.identifier(localName), []));

        return Promise.resolve({modified: true, result: input});
    }

    /**
     * Creates `export const middleware = []` at the end of the program and returns the array.
     */
    private static createExport(input: t.File): t.ArrayExpression {
        const array = t.arrayExpression([]);
        const {body} = input.program;

        body.push(
            t.exportNamedDeclaration(
                t.variableDeclaration('const', [
                    t.variableDeclarator(t.identifier(HydrogenMiddlewareCodemod.EXPORT_NAME), array),
                ]),
            ),
        );

        return array;
    }

    /**
     * Returns the array to append to, normalizing a non-array export value into one.
     */
    private static resolveArray(input: t.File, match: Match): t.ArrayExpression {
        const {declarator, index} = match;
        const {init} = declarator;

        if (t.isArrayExpression(init)) {
            return init;
        }

        if (init === null) {
            declarator.init = t.arrayExpression([]);

            return declarator.init;
        }

        // Bind the existing value to a constant and normalize it to an array, preserving it whether
        // it is a single middleware or already an array.
        const {EXISTING_NAME} = HydrogenMiddlewareCodemod;
        const {body} = input.program;

        body.splice(
            index,
            0,
            t.variableDeclaration('const', [t.variableDeclarator(t.identifier(EXISTING_NAME), init)]),
        );

        const array = t.arrayExpression([spreadAsArray(t.identifier(EXISTING_NAME))]);

        declarator.init = array;

        return array;
    }

    private static hasCall(array: t.ArrayExpression, localName: string): boolean {
        return array.elements.some(
            element => element !== null
                && t.isCallExpression(element)
                && t.isIdentifier(element.callee)
                && element.callee.name === localName,
        );
    }

    private static findDeclarator(ast: t.File): Match | null {
        const {body} = ast.program;

        for (let index = 0; index < body.length; index++) {
            const statement = body[index];
            const declaration = t.isExportNamedDeclaration(statement) ? statement.declaration : statement;

            if (!t.isVariableDeclaration(declaration)) {
                continue;
            }

            for (const declarator of declaration.declarations) {
                if (t.isIdentifier(declarator.id) && declarator.id.name === HydrogenMiddlewareCodemod.EXPORT_NAME) {
                    return {declarator: declarator, index: index};
                }
            }
        }

        return null;
    }
}
