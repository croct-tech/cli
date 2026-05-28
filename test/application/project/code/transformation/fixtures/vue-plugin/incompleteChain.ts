import { createApp } from 'vue';
import App from './App.vue';

const mountFn = createApp(App).mount;
mountFn('#app');
