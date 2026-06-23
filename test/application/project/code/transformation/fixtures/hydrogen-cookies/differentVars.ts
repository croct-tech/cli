export async function handleFetch(request, appLoadContext) {
    const res = await handleRequest(request);

    if (appLoadContext.session.isPending) {
        res.headers.set('Set-Cookie', await appLoadContext.session.commit());
    }

    return res;
}
