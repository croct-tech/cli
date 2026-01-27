const regex = '/((?!api|_next/static|_next/image|favicon.ico).*)';

const configValue = {
    matcher: regex,
}

export const config = configValue;

export function proxy(request) {
    console.log(request.url);
}
