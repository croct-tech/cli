import * as t from '@babel/types';
import traverse from '@babel/traverse';
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

    let ast: t.File;

    try {
        ast = parse(source, ['jsx', 'typescript']);
    } catch {
        return {
            i18n: i18n,
        };
    }

    traverse(ast, {
        ObjectProperty: function accept(path) {
            if (getIdentifier(path.node.key) !== 'i18n') {
                return false;
            }

            const object = path.node.value;

            if (!t.isObjectExpression(object)) {
                return path.stop();
            }

            for (const property of object.properties) {
                if (t.isObjectProperty(property) && getIdentifier(property.key) === 'locales') {
                    const localesNode = property.value;

                    if (t.isArrayExpression(localesNode)) {
                        for (const element of localesNode.elements) {
                            if (element !== null && t.isStringLiteral(element)) {
                                i18n.locales.push(element.value);
                            }
                        }
                    }
                } else if (t.isObjectProperty(property) && getIdentifier(property.key) === 'defaultLocale') {
                    const defaultLocaleNode = property.value;

                    if (defaultLocaleNode !== null && t.isStringLiteral(defaultLocaleNode)) {
                        i18n.defaultLocale = defaultLocaleNode.value;
                    }
                }
            }

            return path.stop();
        },
    });

    return {
        i18n: i18n,
    };
}

function getIdentifier(node: t.Node): string|null {
    if (t.isIdentifier(node)) {
        return node.name;
    }

    if (t.isStringLiteral(node)) {
        return node.value;
    }

    return null;
}
