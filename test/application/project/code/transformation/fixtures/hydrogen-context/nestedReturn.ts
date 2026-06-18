import {createHydrogenContext} from '@shopify/hydrogen';

export async function createAppLoadContext(request, env) {
    const hydrogenContext = createHydrogenContext({env, request});

    hydrogenContext.cart = createCartHandler({
        getCartId: () => {
            return request.headers.get('Cookie');
        },
    });

    return hydrogenContext;
}
