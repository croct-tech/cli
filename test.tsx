

(async () => {
    let counter = 0;

    const promise = LazyPromise.cached(async () => {
        return counter++
    });

    console.log(await promise);
    console.log(await promise);
    console.log(await promise);


})();
