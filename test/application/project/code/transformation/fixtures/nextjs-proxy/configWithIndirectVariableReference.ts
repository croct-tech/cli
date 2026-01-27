const regex = '/((?!api|_next/static|_next/image|favicon.ico).*)';

const configValue = {
    matcher: regex,
}

const indirectReference = configValue;

export const config = indirectReference;

export function proxy(request) {
    console.log(request.url);
}
