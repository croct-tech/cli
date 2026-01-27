function unrelated() {
}

const _proxyFn = function() {
    console.log('proxy');
}

const _config = {
    matcher: '.*'
};

export {
    _proxyFn as default,
    _config as config
};
