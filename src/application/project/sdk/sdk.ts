import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {Slot} from '@/application/model/slot';
import {Help, HelpfulError} from '@/application/error';

export type Installation = {
    input?: Input,
    output: Output,
    configuration: ProjectConfiguration,
};

export type UpdateOptions = {
    clean?: boolean,
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
}

export class SdkError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, SdkError.prototype);
    }
}
