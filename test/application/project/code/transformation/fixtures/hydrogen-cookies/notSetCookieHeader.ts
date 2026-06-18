export async function handleFetch(request, hydrogenContext) {
    const response = await handleRequest(request);

    response.headers.set('Content-Type', 'text/html');

    return response;
}
