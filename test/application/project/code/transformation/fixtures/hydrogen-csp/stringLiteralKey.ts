import {createContentSecurityPolicy} from '@shopify/hydrogen';

const csp = createContentSecurityPolicy({
    'connectSrc': ['https://example.com'],
});
