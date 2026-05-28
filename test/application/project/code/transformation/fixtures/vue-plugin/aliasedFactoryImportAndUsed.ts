import { createApp } from 'vue';
import { createCroct as plug } from '@croct/plug-vue';
import App from './App.vue';

const app = createApp(App);
app.use(plug({ appId: 'YOUR_APP_ID' }));
app.mount('#app');
