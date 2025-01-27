import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Configuration, ResolvedConfiguration} from '@/application/project/configuration/configuration';
import {ApplicationPlatform} from '@/application/model/application';
import {Slot} from '@/application/model/slot';

export type Installation = {
    input?: Input,
    output: Output,
    configuration: ResolvedConfiguration,
};

type Command = {
    name: string,
    args: string[],
};

export type ServerInfo = {
    protocol: 'http' | 'https',
    host: string,
    port?: number,
    defaultPort?: number,
    startCommand: Command,
};

export interface Sdk {
    getPackage(): string;
    getPlatform(): ApplicationPlatform;
    install(installation: Installation): Promise<Configuration>;
    update(installation: Installation): Promise<void>;
    updateTypes(installation: Installation): Promise<void>;
    updateContent(installation: Installation): Promise<void>;
    generateSlotExample(slot: Slot, installation: Installation): Promise<void>;
}

export interface SdkResolver<T extends Sdk|null = Sdk> {
    resolve(hint?: string): Promise<T>;
}
