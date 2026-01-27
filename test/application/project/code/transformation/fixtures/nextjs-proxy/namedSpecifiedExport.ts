const proxy = function() {
    console.log('proxy');
}

const config = {
    matcher: '.*'
};

export { proxy, config };
