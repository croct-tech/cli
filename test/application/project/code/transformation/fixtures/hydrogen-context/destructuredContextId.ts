import {createHydrogenContext} from '@shopify/hydrogen';

export async function createAppLoadContext(request, env) {
    const {storefront} = createHydrogenContext({env, request});

    return {storefront};
}
