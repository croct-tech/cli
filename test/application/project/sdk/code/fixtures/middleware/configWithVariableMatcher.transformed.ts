import { withCroct, matcher } from "@croct/plug-next/middleware";
const regex = '/((?!api|_next/static|_next/image|favicon.ico).*)';

export const config = {
    matcher: [...(Array.isArray(regex) ? regex : [regex]), matcher],
}

export const middleware = withCroct({
    matcher: config.matcher,

    next: function(request) {
        console.log(request.url);
    }
});
