import {createContentSecurityPolicy} from '@shopify/hydrogen';

const csp = createContentSecurityPolicy({
    ...base,
    connectSrc: ['https://example.com'],
});
