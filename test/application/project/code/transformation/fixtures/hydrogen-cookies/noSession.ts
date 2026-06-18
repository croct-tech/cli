export async function handleFetch(request) {
    const response = await handleRequest(request);

    response.headers.set('Set-Cookie', buildCookie());

    return response;
}
