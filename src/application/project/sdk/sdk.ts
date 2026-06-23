import type {Input} from '@/application/cli/io/input';
import type {Output, Task} from '@/application/cli/io/output';
import type {ProjectConfiguration, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import type {Slot} from '@/application/model/slot';
import type {Help} from '@/application/error';
import {HelpfulError} from '@/application/error';

export type Installation = {
    input?: Input,
    output: Output,
    skipApiKeySetup?: boolean,
    configuration: ProjectConfiguration,
};

export type UpdateOptions = {
    clean?: boolean,
};

export type InstallationPlan = {
    tasks: Task[],
    dependencies: string[],
    configuration: ProjectConfiguration,
};

export interface Sdk {
    /**
     * Sets up the SDK in the project.
     *
     * @param installation The installation details.
     *
     * @throws SdkError If an error occurs.
     */
    setup(installation: Installation): Promise<ProjectConfiguration>;

    /**
     * Locates the project paths.
     *
     * @param configuration The project configuration.
     *
     * @returns The project paths.
     */
    getPaths(configuration: ProjectConfiguration): Promise<ProjectPaths>;

    /**
     * Update the SDK artifacts in the project.
     *
     * @param installation The installation details.
     * @param options The update options.
     *
     * @throws SdkError If an error occurs.
     */
    update(installation: Installation, options?: UpdateOptions): Promise<void>;

    /**
     * Generate an example for a slot.
     *
     * @param slot The slot to generate the example for.
     * @param installation The installation details
     *
     * @throws SdkError If an error occurs.
     */
    generateSlotExample(slot: Slot, installation: Installation): Promise<void>;

    /**
     * Tell the user how to view the generated examples, optionally setting them up.
     *
     * Called once after all examples are generated. Implementations report where each example
     * lives and how to open it (a route, a file, a component to import), and may detect the dev
     * server to offer opening it directly.
     *
     * @param slots The slots whose examples were generated.
     * @param installation The installation details.
     */
    presentExamples?(slots: Slot[], installation: Installation): Promise<void>;
}

export class SdkError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, SdkError.prototype);
    }
}
