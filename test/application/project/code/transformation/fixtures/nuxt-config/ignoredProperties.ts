const base = {srcDir: 'base'};

export default defineNuxtConfig({
    ...base,
    ['srcDir']: 'computed',
    1: 'numeric',
    hooks() {},
    srcDir: 'src',
    future: {
        ...base,
        compatibilityVersion: 4,
    },
});
