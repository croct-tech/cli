import {writeCroctCookies} from '@croct/plug-hydrogen/server';

export async function handleFetch(request, hydrogenContext) {
    const response = await handleRequest(request);

    if (hydrogenContext.session.isPending) {
        response.headers.set('Set-Cookie', await hydrogenContext.session.commit());
    }

    writeCroctCookies(response, hydrogenContext);

    return response;
}
