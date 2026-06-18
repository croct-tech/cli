import {createContentSecurityPolicy as createCsp} from '@shopify/hydrogen';

const csp = createCsp({
    connectSrc: ['https://example.com'],
});
