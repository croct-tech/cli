const middleware = function() {
    console.log('middleware');
}

const config = {
    matcher: '.*'
};

export { middleware, config };
