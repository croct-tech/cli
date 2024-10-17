import { withCroct, matcher } from "@croct/plug-next/middleware";
const regex = '/((?!api|_next/static|_next/image|favicon.ico).*)';

const configValue = {
    matcher: [...(Array.isArray(regex) ? regex : [regex]), matcher],
}

const indirectReference = configValue;

export const config = indirectReference;

export const middleware = withCroct({
    matcher: configValue.matcher,

    next: function(request) {
        console.log(request.url);
    }
});
