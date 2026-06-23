export async function handleFetch(request, appLoadContext) {
    const response = await handleRequest(request);

    response.headers.set('Set-Cookie', await appLoadContext.session.commit());

    return response;
}
