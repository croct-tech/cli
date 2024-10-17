import { withCroct, matcher } from "@croct/plug-next/middleware";
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)', matcher],
}

export const middleware = withCroct({
    matcher: config.matcher,

    next: function(request) {
        console.log(request.url);
    }
});
