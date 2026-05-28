import { createApp } from 'vue';
import { StoryblokVue as SbVue, apiPlugin } from '@storyblok/vue';
import App from './App.vue';

const app = createApp(App);
app.use(SbVue, {
    accessToken: 'YOUR_ACCESS_TOKEN',
    use: [apiPlugin],
});
app.mount('#app');
