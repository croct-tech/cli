import {createRequestHandler} from '@shopify/hydrogen';

export default {
    async fetch(request, env, executionContext) {
        const hydrogenContext = await createHydrogenRouterContext(request, env, executionContext);
        const handleRequest = createRequestHandler({build: serverBuild, getContext: () => hydrogenContext});
        const response = await handleRequest(request);

        if (hydrogenContext.session.isPending) {
            response.headers.set('Set-Cookie', await hydrogenContext.session.commit());
        }

        return response;
    },
};
