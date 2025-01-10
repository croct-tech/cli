export const config = {
    matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
export function middleware(request) {
    console.log(request.url);
}
