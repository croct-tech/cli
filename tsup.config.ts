import type {Plugin} from 'esbuild';
import {defineConfig} from 'tsup';

// Modules whose code paths are unreachable in our usage. Resolving them to
// an empty module saves ~700KB:
//   - `@babel/preset-typescript`: loaded by @babel/core for `.cts` configs
//     (we always pass configFile: false).
//   - `esprima`: recast's tokenizer fallback when AST has no `tokens`; our
//     `@babel/parser`-based recast parser always provides them.
//   - `browserslist`: required by @babel/helper-compilation-targets; never
//     invoked since we set `browserslistConfigFile: false`.
const namespace = 'stub-unreachable-modules';
const pattern = /^@babel\/preset-typescript(\/.*)?$|^esprima$|^browserslist$/;

const stubUnreachableModules: Plugin = {
    name: namespace,
    setup(build) {
        build.onResolve(
            {filter: pattern},
            args => ({path: args.path, namespace}),
        );
        build.onLoad(
            {filter: /.*/, namespace},
            () => ({contents: 'module.exports = {};', loader: 'js'}),
        );
    },
};

export default defineConfig({
    entry: {
        index: 'src/program.ts',
    },
    format: 'esm',
    target: 'esnext',
    platform: 'node',
    clean: true,
    sourcemap: false,
    minify: true,
    outDir: 'build',
    treeshake: true,
    // Bundle every dependency into the output so consumers don't get
    // anything installed transitively (avoids version conflicts in host projects).
    noExternal: [/.*/],
    esbuildPlugins: [stubUnreachableModules],
    banner: ({format}) => {
        if (format === 'esm') {
            return ({
            // Shim for the `require` function in ESM to fix commander.js import
                js: 'import { createRequire } from \'module\'; const require = createRequire(import.meta.url);',
            });
        }

        return {};
    },
});
