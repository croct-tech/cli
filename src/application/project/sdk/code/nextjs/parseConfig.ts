import {parse} from '@babel/parser';
import traverse from '@babel/traverse';

export type NextConfig = {
    i18n: {
        locales: string[],
        defaultLocale?: string,
    },
};

export function parseConfig(source: string): NextConfig {
    const ast = parse(source, {
        sourceType: 'module',
        plugins: ['typescript'],
    });

    const i18n = {
        locales: Array<string>(),
        defaultLocale: '',
    } satisfies NextConfig['i18n'];

    traverse(ast, {
        enter: path => {
            if (
                path.node.type === 'ObjectProperty'
                && path.node.key.type === 'Identifier'
                && path.node.key.name === 'i18n'
            ) {
                const object = path.node.value;

                if (object.type === 'ObjectExpression') {
                    for (const property of object.properties) {
                        if (
                            property.type === 'ObjectProperty'
                            && property.key.type === 'Identifier'
                            && property.key.name === 'locales'
                        ) {
                            const localesNode = property.value;

                            if (localesNode.type === 'ArrayExpression') {
                                for (const element of localesNode.elements) {
                                    if (element !== null && element.type === 'StringLiteral') {
                                        i18n.locales.push(element.value);
                                    }
                                }
                            }
                        } else if (
                            property.type === 'ObjectProperty'
                            && property.key.type === 'Identifier'
                            && property.key.name === 'defaultLocale'
                        ) {
                            const defaultLocaleNode = property.value;

                            if (defaultLocaleNode !== null && defaultLocaleNode.type === 'StringLiteral') {
                                i18n.defaultLocale = defaultLocaleNode.value;
                            }
                        }
                    }

                    path.stop();
                }
            }
        },
    });

    return {
        i18n: i18n,
    };
}
