import type {Input} from '@/application/cli/io/input';
import type {Output} from '@/application/cli/io/output';
import type {ExampleServer} from '@/application/project/example/exampleServer';

/**
 * What an example uses to present itself.
 */
export type ExampleContext = {
    input?: Input,
    output: Output,
    server: ExampleServer,
};

/**
 * A generated slot example that knows how to point the developer at itself.
 */
export abstract class Example {
    protected readonly name: string;

    protected constructor(name: string) {
        this.name = name;
    }

    /**
     * Opens the example or tells the developer how to reach it.
     */
    public abstract present(context: ExampleContext): Promise<void>;
}

/**
 * An example served by the application at a URL (e.g. `/croct/home-hero`).
 */
export class UrlExample extends Example {
    private readonly path: string;

    public constructor(name: string, path: string) {
        super(name);

        this.path = path;
    }

    public present({server}: ExampleContext): Promise<void> {
        return server.open(this.name, this.path);
    }
}

/**
 * An example the developer wires up by following an instruction (e.g. importing a component).
 */
export class InstructionExample extends Example {
    private readonly instruction: string;

    public constructor(name: string, instruction: string) {
        super(name);

        this.instruction = instruction;
    }

    public present({output}: ExampleContext): Promise<void> {
        output.inform(this.instruction);

        return Promise.resolve();
    }
}
