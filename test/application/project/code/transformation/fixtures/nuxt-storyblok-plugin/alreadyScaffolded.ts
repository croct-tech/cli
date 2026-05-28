import { withCroct } from '@croct/plug-storyblok/nuxt';
import { useStoryblokApi } from '@storyblok/vue';
import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin(nuxtApp => {
    withCroct(nuxtApp, useStoryblokApi());
});
