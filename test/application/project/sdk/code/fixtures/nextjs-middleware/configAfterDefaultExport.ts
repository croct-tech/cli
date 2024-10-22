import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest): void {
    console.log(request.url);
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
