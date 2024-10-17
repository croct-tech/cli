import { withCroct, matcher } from "@croct/plug-next/middleware";

const _config = {
    matcher: ['.*', matcher]
};

const _middlewareFn = withCroct({
    matcher: _config.matcher,

    next: function() {
        console.log('middleware');
    }
})

export {
    _middlewareFn as default,
    _config as config
};
