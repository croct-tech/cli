import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';

const version = '2024';
const config = defineConfig({
    plugins: [hydrogen()],
});

export default config;
