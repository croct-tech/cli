import {namedTypes as Ast} from 'ast-types';
import {visit} from 'recast';
import {parse} from '@/application/project/sdk/code/parser';

export type NextConfig = {
    i18n: {
        locales: string[],
        defaultLocale?: string,
    },
};

/**
 * Parse the Next.js configuration.
 *
 * This function extracts the i18n configuration from the Next.js configuration
 * statically in a best-effort manner.
 *
 * @param source The source code of the Next.js configuration.
 */
export function parseConfig(source: string): NextConfig {
    const i18n: NextConfig['i18n'] = {
        locales: Array<string>(),
    };

    let ast: Ast.Node;

    try {
        ast = parse(source, ['jsx', 'typescript']);
    } catch {
        return {
            i18n: i18n,
        };
    }

    visit(ast, {
        visitObjectProperty: function accept(path) {
            if (!Ast.Identifier.check(path.node.key) || path.node.key.name !== 'i18n') {
                return false;
            }

            const object = path.node.value;

            if (!Ast.ObjectExpression.check(object)) {
                return this.abort();
            }

            for (const property of object.properties) {
                if (
                    Ast.ObjectProperty.check(property)
                    && Ast.Identifier.check(property.key)
                    && property.key.name === 'locales'
                ) {
                    const localesNode = property.value;

                    if (Ast.ArrayExpression.check(localesNode)) {
                        for (const element of localesNode.elements) {
                            if (element !== null && Ast.StringLiteral.check(element)) {
                                i18n.locales.push(element.value);
                            }
                        }
                    }
                } else if (
                    Ast.ObjectProperty.check(property)
                    && Ast.Identifier.check(property.key)
                    && property.key.name === 'defaultLocale'
                ) {
                    const defaultLocaleNode = property.value;

                    if (defaultLocaleNode !== null && Ast.StringLiteral.check(defaultLocaleNode)) {
                        i18n.defaultLocale = defaultLocaleNode.value;
                    }
                }
            }

            return this.abort();
        },
    });

    return {
        i18n: i18n,
    };
}
