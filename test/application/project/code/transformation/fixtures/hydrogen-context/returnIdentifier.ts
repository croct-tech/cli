import {createHydrogenContext} from '@shopify/hydrogen';

export async function createAppLoadContext(request, env, executionContext) {
    const hydrogenContext = createHydrogenContext({
        env,
        request,
        cache: await caches.open('hydrogen'),
    });

    return hydrogenContext;
}
