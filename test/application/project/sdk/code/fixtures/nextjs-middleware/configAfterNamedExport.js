export default function middleware(request) {
    console.log(request.url);
}
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
