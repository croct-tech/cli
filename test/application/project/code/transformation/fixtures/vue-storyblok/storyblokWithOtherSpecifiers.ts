import { createApp } from 'vue';
import { StoryblokVue, apiPlugin, useStoryblok } from '@storyblok/vue';
import App from './App.vue';

const app = createApp(App);
app.use(StoryblokVue, {
    accessToken: 'YOUR_ACCESS_TOKEN',
    use: [apiPlugin],
});
app.mount('#app');

export { useStoryblok };
