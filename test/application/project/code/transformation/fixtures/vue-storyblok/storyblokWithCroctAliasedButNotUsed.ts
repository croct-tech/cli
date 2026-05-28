import { createApp } from 'vue';
import { StoryblokVue, apiPlugin } from '@storyblok/vue';
import { withCroct as croctSb } from '@croct/plug-storyblok/vue';
import App from './App.vue';

const app = createApp(App);
app.use(StoryblokVue, {
    accessToken: 'YOUR_ACCESS_TOKEN',
    use: [apiPlugin],
});
app.mount('#app');
