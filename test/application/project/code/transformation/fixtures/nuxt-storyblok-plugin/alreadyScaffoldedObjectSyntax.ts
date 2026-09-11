import { withCroct } from '@croct/plug-storyblok/nuxt';
import { useStoryblokApi } from '@storyblok/vue';
import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin({
    name: 'croct-storyblok',
    enforce: 'post',
    setup(nuxtApp) {
        withCroct(nuxtApp, useStoryblokApi());
    },
});
