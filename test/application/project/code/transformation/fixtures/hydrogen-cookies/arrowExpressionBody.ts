export const handle = (request, hydrogenContext) => response.headers.set(
    'Set-Cookie',
    hydrogenContext.session.commit(),
);
