import { createApp } from 'vue';
import App from './App.vue';
import Other from './Other.vue';

const app = createApp(App);
app.mount('#app');

createApp(Other).mount('#second');
