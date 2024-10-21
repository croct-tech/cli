const regex = '/((?!api|_next/static|_next/image|favicon.ico).*)';

export const config = {
    matcher: regex,
}

export function middleware(request) {
    console.log(request.url);
}
