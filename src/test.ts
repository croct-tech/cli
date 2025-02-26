(async () => {
    async function test() {
        try {
            throw new Error('Console');
        } catch (error) {
            console.log('Awaiting catch');

            await new Promise(resolve => setTimeout(resolve, 3000));

            throw error;
        } finally {
            console.log('Awaiting finally');

            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log('Result:', await test());
})();
