import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';

const basePlugins = [hydrogen()];

export default defineConfig({
    plugins: basePlugins,
});
