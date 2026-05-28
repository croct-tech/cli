import { createApp } from 'vue';
import { createCroct } from '@croct/plug-vue';
import App from './App.vue';

createApp(App).use(createCroct({ appId: 'YOUR_APP_ID' })).mount('#app');
