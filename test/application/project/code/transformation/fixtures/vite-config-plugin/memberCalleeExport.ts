import * as vite from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';

export default vite.defineConfig({
    plugins: [hydrogen()],
});
