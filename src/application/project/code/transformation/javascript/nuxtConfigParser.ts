import * as t from '@babel/types';
import type {NodePath} from '@babel/core';
import {traverse} from '@babel/core';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';
import {NuxtConfigModuleCodemod} from '@/application/project/code/transformation/javascript/nuxtConfigModuleCodemod';

export type NuxtConfig = {
    srcDir?: string,
    future?: {
        compatibilityVersion?: number,
    },
};

/**
 * Parses the Nuxt configuration options that determine the project layout.
 *
 * The extraction is static and best-effort: an option is only reported when
 * its value can be evaluated without running the configuration, such as
 * literals and references to constants.
 */
export class NuxtConfigParser {
    public parse(source: string): NuxtConfig {
        let ast: t.File;

        try {
            ast = parse(source, ['typescript']);
        } catch {
            return {};
        }

        const config = NuxtConfigModuleCodemod.findConfig(ast);

        if (config === null) {
            return {};
        }

        const result: NuxtConfig = {};

        traverse(ast, {
            ObjectExpression: path => {
                if (path.node !== config) {
                    return;
                }

                const srcDir = NuxtConfigParser.evaluateProperty(path, 'srcDir');

                if (typeof srcDir === 'string') {
                    result.srcDir = srcDir;
                }

                const future = NuxtConfigParser.findProperty(path, 'future')?.get('value');

                if (future !== undefined && future.isObjectExpression()) {
                    const version = NuxtConfigParser.evaluateProperty(future, 'compatibilityVersion');

                    if (typeof version === 'number') {
                        result.future = {
                            compatibilityVersion: version,
                        };
                    }
                }

                path.stop();
            },
        });

        return result;
    }

    private static evaluateProperty(object: NodePath<t.ObjectExpression>, name: string): unknown {
        const evaluation = NuxtConfigParser.findProperty(object, name)
            ?.get('value')
            .evaluate();

        return evaluation?.confident === true ? evaluation.value : undefined;
    }

    private static findProperty(
        object: NodePath<t.ObjectExpression>,
        name: string,
    ): NodePath<t.ObjectProperty> | null {
        let match: NodePath<t.ObjectProperty> | null = null;

        // Later properties override earlier ones, as in the evaluated object
        for (const property of object.get('properties')) {
            if (
                property.isObjectProperty()
                && !property.node.computed
                && NuxtConfigParser.hasKey(property.node, name)
            ) {
                match = property;
            }
        }

        return match;
    }

    private static hasKey(property: t.ObjectProperty, name: string): boolean {
        const {key} = property;

        return (t.isIdentifier(key) && key.name === name) || (t.isStringLiteral(key) && key.value === name);
    }
}
