export async function handleFetch(request, hydrogenContext) {
    const response = await handleRequest(request);

    response.cookies.set('Set-Cookie', await hydrogenContext.session.commit());

    return response;
}
