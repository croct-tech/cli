import type { NextRequest } from 'next/server'

// middleware
export function middleware(request: NextRequest): void {
    console.log(request.url);
}

function unrelated() {
}

// Non-global scope
{
    // Different scope, should not be considered
    const PATTERN = null;

    function getMatcher() {
    }

    class Matcher {
    }
}

// pattern
const PATTERN = '/((?!api|_next/static|_next/image|favicon.ico).*)';

// matcher
class Matcher {
    static readonly PATTERN = PATTERN;
}

// getMatcher
function getMatcher() {
    return Matcher.PATTERN;
}

// currentMatcher
const currentMatcher = getMatcher();

// currentConfig
const currentConfig = {
    matcher: currentMatcher,
}

// config
export const config = currentConfig;
