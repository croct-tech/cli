import {createContentSecurityPolicy} from '@shopify/hydrogen';

const csp = createContentSecurityPolicy({
    connectSrc: defaultSources,
});
