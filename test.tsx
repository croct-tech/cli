import {ConsoleInput} from "./src/infrastructure/application/cli/io/consoleInput";

(async () => {
    const input = new ConsoleInput({
        input: process.stdin,
        output: process.stdout,
        onAbort: () => process.exit(1),
    });

    console.log(await input.wait({message: 'Press any key to continue', key: 'enter'}));
})();
