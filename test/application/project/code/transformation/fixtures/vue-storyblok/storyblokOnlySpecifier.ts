import { createApp } from 'vue';
import { StoryblokVue } from '@storyblok/vue';
import App from './App.vue';

const app = createApp(App);
app.use(StoryblokVue, {
    accessToken: 'YOUR_ACCESS_TOKEN',
});
app.mount('#app');
