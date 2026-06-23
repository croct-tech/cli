import {createHydrogenContext as createContext} from '@shopify/hydrogen';

export async function createAppLoadContext(request, env, executionContext) {
    const hydrogenContext = createContext({env, request});

    return {
        ...hydrogenContext,
        extra: true,
    };
}
