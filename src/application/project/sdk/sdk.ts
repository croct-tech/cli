import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {ProjectConfiguration, ResolvedConfiguration} from '@/application/project/configuration/projectConfiguration';
import {Slot} from '@/application/model/slot';
import {Help, HelpfulError} from '@/application/error';

export type Installation = {
    input?: Input,
    output: Output,
    configuration: ResolvedConfiguration,
};

export interface Sdk {
    install(installation: Installation): Promise<ProjectConfiguration>;
    update(installation: Installation): Promise<void>;
    updateTypes(installation: Installation): Promise<void>;
    updateContent(installation: Installation): Promise<void>;
    generateSlotExample(slot: Slot, installation: Installation): Promise<void>;
}

export class SdkError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, SdkError.prototype);
    }
}
