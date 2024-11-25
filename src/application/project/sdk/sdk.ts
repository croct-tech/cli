import {ApplicationPlatform, Slot} from '@/application/model/entities';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {ProjectConfiguration, ResolvedProjectConfiguration} from '@/application/project/configuration';

export type Installation = {
    input: Input,
    output: Output,
    configuration: ResolvedProjectConfiguration,
};

export interface Sdk {
    getPackage(): string;
    getPlatform(): ApplicationPlatform;
    install(installation: Installation): Promise<ProjectConfiguration>;
    update(installation: Installation): Promise<void>;
    updateTypes(installation: Installation): Promise<void>;
    updateContent(installation: Installation): Promise<void>;
    generateSlotExample(slot: Slot, installation: Installation): Promise<void>;
}

export interface SdkResolver<T extends Sdk|null = Sdk> {
    resolve(hint?: string): Promise<T>;
}
