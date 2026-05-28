import { createApp } from 'vue';
import App from './App.vue';

const app = createApp(App);
const flag = true;
app.use(router);
console.log(flag);
app.mount('#app');
