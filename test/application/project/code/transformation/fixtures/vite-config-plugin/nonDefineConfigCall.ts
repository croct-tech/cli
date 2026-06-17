import {hydrogen} from '@shopify/hydrogen/vite';

function wrapConfig(config) {
    return config;
}

export default wrapConfig({
    plugins: [hydrogen()],
});
