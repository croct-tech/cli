import { StoryblokVue } from '@storyblok/vue';

const app = { use: () => app, mount: () => {} };

app.use(StoryblokVue, { accessToken: 'YOUR_ACCESS_TOKEN' });
app.mount('#app');
