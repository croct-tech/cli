import {defineConfig} from "tsup";

export default defineConfig({
    entry: {
        "index": "src/program.ts",
    },
    clean: true,
    sourcemap: false,
    minify: true,
    outDir: "build",
    shims: true,
    treeshake: true,
});
