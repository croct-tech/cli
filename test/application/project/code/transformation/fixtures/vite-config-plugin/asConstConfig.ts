import {defineConfig} from 'vite';
import type {UserConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';

export default defineConfig({
    plugins: [hydrogen()],
}) as UserConfig;
