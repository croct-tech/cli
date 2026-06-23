export async function handleFetch(request, hydrogenContext) {
    const response = await handleRequest(request);
    const {headers} = response;

    headers.set('Set-Cookie', await hydrogenContext.session.commit());

    return response;
}
