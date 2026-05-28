import { createApp } from 'vue';
import { StoryblokVue, apiPlugin } from '@storyblok/vue';
import App from './App.vue';

createApp(App)
    .use(StoryblokVue, {
        accessToken: 'YOUR_ACCESS_TOKEN',
        use: [apiPlugin],
    })
    .mount('#app');
