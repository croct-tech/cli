import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';

const base = {server: {port: 3000}};

export default defineConfig({
    ...base,
    plugins: [hydrogen()],
});
