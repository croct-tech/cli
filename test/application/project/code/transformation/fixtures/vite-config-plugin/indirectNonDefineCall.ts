import {hydrogen} from '@shopify/hydrogen/vite';

function build() {
    return {plugins: [hydrogen()]};
}

const config = build();

export default config;
