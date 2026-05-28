import { createApp } from 'vue';
import { createCroct } from '@croct/plug-vue';
import App from './App.vue';

const app = createApp(App);
app['use'](router);
app.config.globalProperties.foo = 'bar';
console.log('hi');
app.mixin({});
app.mount('#app');

