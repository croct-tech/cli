import {createContentSecurityPolicy} from '@shopify/hydrogen';

export default function handleRequest(request, context) {
    const {header} = createContentSecurityPolicy({
        shop: {
            checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
            storeDomain: context.env.PUBLIC_STORE_DOMAIN,
        },
    });

    return header;
}
