import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {croct} from '@croct/plug-hydrogen/vite';

export default defineConfig({
    plugins: [hydrogen(), , croct()],
});
