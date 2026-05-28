import { createApp } from 'vue';
import { apiPlugin } from '@storyblok/vue';
import { withCroct } from '@croct/plug-storyblok/vue';
import App from './App.vue';

const app = createApp(App);
app.use(withCroct({
    accessToken: 'YOUR_ACCESS_TOKEN',
    use: [apiPlugin],
}));
app.mount('#app');
