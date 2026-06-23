import {createHydrogenContext} from '@shopify/hydrogen';

export async function createAppLoadContext(request, env) {
    const hydrogenContext = createHydrogenContext({env, request});

    if (!request) {
        return;
    }

    doSomething(hydrogenContext);
}
