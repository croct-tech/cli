import {createHydrogenContext} from '@shopify/hydrogen';

export async function createAppLoadContext(request, env, executionContext) {
    const hydrogenContext = await createHydrogenContext({env, request});

    return hydrogenContext;
}
