import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';

const config = defineConfig({
    plugins: [hydrogen()],
});

export default config;
