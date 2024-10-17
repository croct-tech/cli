import { withCroct, matcher } from "@croct/plug-next/middleware";

const config = {
    matcher: ['.*', matcher]
};

const middleware = withCroct({
    matcher: config.matcher,

    next: function() {
        console.log('middleware');
    }
})

export { middleware, config };
