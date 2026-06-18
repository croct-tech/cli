import {createHydrogenContext} from '@shopify/hydrogen';
import {createCroctContext} from '@croct/plug-hydrogen/server';

export async function createAppLoadContext(request, env, executionContext) {
    const hydrogenContext = createHydrogenContext({env, request});

    return {
        ...hydrogenContext,
        croct: await createCroctContext(request, hydrogenContext),
    };
}
