import { createApp } from 'vue';
import App from './App.vue';
import Other from './Other.vue';

createApp(App).mount('#app');

const second = createApp(Other);
second.mount('#second');
