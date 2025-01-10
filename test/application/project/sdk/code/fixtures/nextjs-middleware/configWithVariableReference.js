const regex = '/((?!api|_next/static|_next/image|favicon.ico).*)';
const configValue = {
    matcher: regex,
};
export const config = configValue;
export function middleware(request) {
    console.log(request.url);
}
