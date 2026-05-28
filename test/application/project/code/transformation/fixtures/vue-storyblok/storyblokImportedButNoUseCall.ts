import { createApp } from 'vue';
import { StoryblokVue } from '@storyblok/vue';
import App from './App.vue';

console.log(StoryblokVue);

const app = createApp(App);
app.mount('#app');
