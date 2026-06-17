import {createHydrogenContext} from '@shopify/hydrogen';

export async function createAppLoadContext() {
    const hydrogenContext = createHydrogenContext({});

    return hydrogenContext;
}
