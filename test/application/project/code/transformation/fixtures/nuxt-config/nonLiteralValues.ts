import {fileURLToPath} from 'node:url';

export default defineNuxtConfig({
    srcDir: fileURLToPath(new URL('./src', import.meta.url)),
    future: {
        compatibilityVersion: Number(process.env.NUXT_COMPATIBILITY_VERSION),
    },
});
