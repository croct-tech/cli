import { withCroct, matcher } from "@croct/plug-next/middleware";
import type { NextRequest } from 'next/server'


const PATTERN = '/((?!api|_next/static|_next/image|favicon.ico).*)';

class Matcher {
    static readonly PATTERN = PATTERN;
}

function getMatcher() {
    return Matcher.PATTERN;
}

const currentMatcher = getMatcher();

const currentConfig = {
    matcher: [
        ...(Array.isArray(currentMatcher) ? currentMatcher : [currentMatcher]),
        matcher
    ],
}

export const middleware = withCroct({
    matcher: currentConfig.matcher,

    next: function(request: NextRequest) {
        console.log(request.url);
    }
});

export const config = currentConfig;
