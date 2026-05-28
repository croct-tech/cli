import { createApp } from 'vue';
import { StoryblokVue, apiPlugin } from '@storyblok/vue';
import App from './App.vue';
import MyComponent from './MyComponent.vue';

const sharedOptions = { foo: 'bar' };

const app = createApp(App);
app.use(StoryblokVue, {
    accessToken: 'YOUR_ACCESS_TOKEN',
    use: [apiPlugin],
    components: { MyComponent },
    ...sharedOptions,
});
app.mount('#app');
