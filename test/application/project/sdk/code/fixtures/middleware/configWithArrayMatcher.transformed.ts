import { withCroct, matcher } from "@croct/plug-next/middleware";
import type { NextRequest } from 'next/server'

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)', matcher],
}

export const middleware = withCroct({
    matcher: config.matcher,

    next: function(request: NextRequest) {
        console.log(request.url);
    }
});
