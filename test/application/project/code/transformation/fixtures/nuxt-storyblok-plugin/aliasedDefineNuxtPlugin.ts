import { defineNuxtPlugin as defineNuxt } from '#app';

export default defineNuxt(nuxtApp => {
    console.log('custom plugin', nuxtApp);
});
