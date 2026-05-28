import { createApp } from 'vue';
import { StoryblokVue, apiPlugin } from '@storyblok/vue';
import router from './router';
import pinia from './pinia';
import App from './App.vue';

const app = createApp(App);
app.use(router);
app.use(StoryblokVue, {
    accessToken: 'YOUR_ACCESS_TOKEN',
    use: [apiPlugin],
});
app.use(pinia);
app.mount('#app');
