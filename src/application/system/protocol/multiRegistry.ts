import {ProtocolHandler, ProtocolRegistry} from '@/application/system/protocol/protocolRegistry';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    fileSystem: FileSystem,
    appDirectory: string,
};

export class MultiRegistry implements ProtocolRegistry {
    private readonly registries: ProtocolRegistry[];

    public constructor(...registries: ProtocolRegistry[]) {
        this.registries = registries;
    }

    public async isRegistered(protocol: string): Promise<boolean> {
        for (const registry of this.registries) {
            if (!await registry.isRegistered(protocol)) {
                return false;
            }
        }

        return true;
    }

    public async register(handler: ProtocolHandler): Promise<void> {
        for (const registry of this.registries) {
            await registry.register(handler);
        }
    }

    public async unregister(protocol: string): Promise<void> {
        for (const registry of this.registries) {
            await registry.unregister(protocol);
        }
    }
}
