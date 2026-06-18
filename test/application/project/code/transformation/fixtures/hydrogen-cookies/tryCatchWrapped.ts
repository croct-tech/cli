import {storefrontRedirect, createRequestHandler} from '@shopify/hydrogen';
import {createAppLoadContext} from '~/lib/context';

export default {
    async fetch(request, env, executionContext) {
        try {
            const appLoadContext = await createAppLoadContext(request, env, executionContext);
            const handleRequest = createRequestHandler({
                build: remixBuild,
                mode: process.env.NODE_ENV,
                getLoadContext: () => appLoadContext,
            });

            const response = await handleRequest(request);

            if (appLoadContext.session.isPending) {
                response.headers.set('Set-Cookie', await appLoadContext.session.commit());
            }

            if (response.status === 404) {
                return storefrontRedirect({request, response, storefront: appLoadContext.storefront});
            }

            return response;
        } catch (error) {
            console.error(error);
            return new Response('An unexpected error occurred', {status: 500});
        }
    },
};
