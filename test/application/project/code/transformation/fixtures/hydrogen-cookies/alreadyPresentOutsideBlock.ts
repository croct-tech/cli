import {writeCroctCookies} from '@croct/plug-hydrogen/server';

export async function handleFetch(request, appLoadContext) {
    let response;

    try {
        response = await handleRequest(request);

        if (appLoadContext.session.isPending) {
            response.headers.set('Set-Cookie', await appLoadContext.session.commit());
        }
    } catch (error) {
        response = new Response('error', {status: 500});
    }

    // Already called, but in the function body — not in the `try` block that holds the Set-Cookie.
    writeCroctCookies(response, appLoadContext);

    return response;
}
