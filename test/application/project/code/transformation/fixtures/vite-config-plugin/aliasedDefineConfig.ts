import {defineConfig as define} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';

export default define({
    plugins: [hydrogen()],
});
