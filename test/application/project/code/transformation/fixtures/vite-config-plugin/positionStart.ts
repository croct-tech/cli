import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';

export default defineConfig({
    plugins: [hydrogen()],
});
