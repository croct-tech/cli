import {SpawnExecutor} from "./src/infrastructure/application/command/spawnExecutor";

(async () => {
    const executor = new SpawnExecutor();

    const execution = executor.run("tsx", ['test2.tsx'], {
        timeout: 1000,
    });

    console.log('exit code', await execution.wait());

    console.log('result', execution.output);

})();
