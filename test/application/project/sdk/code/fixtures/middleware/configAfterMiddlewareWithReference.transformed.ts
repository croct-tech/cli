import { withCroct, matcher } from "@croct/plug-next/middleware";
import type { NextRequest } from 'next/server'

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
    matcher: [
        ...(Array.isArray(currentMatcher) ? currentMatcher : [currentMatcher]),
        matcher
    ],
}

// middleware
export const middleware = withCroct({
    matcher: currentConfig.matcher,

    next: function(request: NextRequest) {
        console.log(request.url);
    }
});

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

// config
export const config = currentConfig;
