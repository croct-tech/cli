import {defineConfig} from "tsup";
export default defineConfig({
    entry: {
        "index": "src/program.ts",
    },
    format: "esm",
    target: "esnext",
    clean: true,
    sourcemap: false,
    minify: false,
    outDir: "build",
    treeshake: true,
    banner: ({ format }) => {
        if (format === "esm") return ({
            js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
        })
        return {}
    },
});
