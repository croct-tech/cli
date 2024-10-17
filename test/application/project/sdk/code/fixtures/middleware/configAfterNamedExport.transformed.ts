import { withCroct, matcher } from "@croct/plug-next/middleware";
import type { NextRequest } from 'next/server'

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)', matcher],
}

export default withCroct({
    matcher: config.matcher,

    next: function middleware(request: NextRequest) {
        console.log(request.url);
    }
});
