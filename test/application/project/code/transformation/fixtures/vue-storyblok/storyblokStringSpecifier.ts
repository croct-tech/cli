import { createApp } from 'vue';
import { 'apiPlugin' as apiPlugin, StoryblokVue } from '@storyblok/vue';
import App from './App.vue';

const app = createApp(App);
app.use(StoryblokVue, {
    accessToken: 'YOUR_ACCESS_TOKEN',
    use: [apiPlugin],
});
app.mount('#app');
