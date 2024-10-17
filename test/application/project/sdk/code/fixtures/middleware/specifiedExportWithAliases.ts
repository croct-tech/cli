const _middlewareFn = function() {
    console.log('middleware');
}

const _config = {
    matcher: '.*'
};

export {
    _middlewareFn as default,
    _config as config
};
