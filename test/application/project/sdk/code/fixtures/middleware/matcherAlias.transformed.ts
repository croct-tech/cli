import { withCroct, matcher as croctMatcher } from "@croct/plug-next/middleware";

export const config = {
    matcher: ['.*', croctMatcher]
};

export const middleware = withCroct({
    matcher: config.matcher,

    next: function() {
        console.log('middleware');
    }
});
