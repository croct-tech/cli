import type { NextRequest } from 'next/server'


export function middleware(request: NextRequest): void {
    console.log(request.url);
}

const PATTERN = '/((?!api|_next/static|_next/image|favicon.ico).*)';

class Matcher {
    static readonly PATTERN = PATTERN;
}

function getMatcher() {
    return Matcher.PATTERN;
}

const currentMatcher = getMatcher();

const currentConfig = {
    matcher: currentMatcher,
}

export const config = currentConfig;
