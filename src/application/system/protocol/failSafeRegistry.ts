import {ProtocolHandler, ProtocolRegistry, ProtocolRegistryError} from '@/application/system/protocol/protocolRegistry';

export class FailSafeRegistry implements ProtocolRegistry {
    private readonly registry: ProtocolRegistry;

    public constructor(registry: ProtocolRegistry) {
        this.registry = registry;
    }

    public isRegistered(protocol: string): Promise<boolean> {
        return this.registry.isRegistered(protocol);
    }

    public async register(handler: ProtocolHandler): Promise<void> {
        try {
            await this.registry.register(handler);
        } catch (error) {
            FailSafeRegistry.handleError(error);
        }
    }

    public async unregister(protocol: string): Promise<void> {
        try {
            await this.registry.unregister(protocol);
        } catch (error) {
            FailSafeRegistry.handleError(error);
        }
    }

    private static handleError(error: any): void {
        if (!(error instanceof ProtocolRegistryError)) {
            throw error;
        }
    }
}
