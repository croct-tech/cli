export default defineNuxtConfig({
    modules: [
        ['some-module', {srcDir: 'src', future: {compatibilityVersion: 4}}],
    ],
});
