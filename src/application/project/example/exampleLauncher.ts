import type {Input} from '@/application/cli/io/input';
import type {Output} from '@/application/cli/io/output';
import type {Provider} from '@/application/provider/provider';
import type {Server} from '@/application/project/server/server';
import type {Example} from '@/application/project/example/example';
import {ExampleServer} from '@/application/project/example/exampleServer';

export type Presentation = {
    examples: Example[],
    input?: Input,
    output: Output,
};

/**
 * Presents the generated examples, owning the dev-server lifecycle.
 *
 * Builds the {@link ExampleServer} each example presents against, runs every example, then shuts
 * down a server it started.
 */
export class ExampleLauncher {
    private readonly serverProvider: Provider<Server | null>;

    public constructor(serverProvider: Provider<Server | null>) {
        this.serverProvider = serverProvider;
    }

    public async launch({examples, input, output}: Presentation): Promise<void> {
        const server = new ExampleServer(this.serverProvider, input, output);

        for (const example of examples) {
            await example.present({input: input, output: output, server: server});
        }

        await server.close();
    }
}
