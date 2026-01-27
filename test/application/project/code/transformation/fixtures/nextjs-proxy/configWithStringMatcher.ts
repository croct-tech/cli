export const config = {
    matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}

export function proxy(request) {
    console.log(request.url);
}
