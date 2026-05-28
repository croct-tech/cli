import { createApp } from 'vue';
import { createCroct } from '@croct/plug-vue';
import App from './App.vue';

const app = createApp(App);
app.use(createCroct({ appId: 'YOUR_APP_ID' }));
app.mount('#app');
