import {ProtocolHandler, ProtocolRegistry, ProtocolRegistryError} from '@/application/system/protocol/protocolRegistry';
import {Output} from '@/application/cli/io/output';
import {ErrorReason} from '@/application/error';

export type Configuration = {
    macOsRegistry: ProtocolRegistry,
    firefoxRegistry: ProtocolRegistry,
    output: Output,
};

export class MacOsFirefoxRegistry implements ProtocolRegistry {
    protected readonly macOsRegistry: ProtocolRegistry;

    protected readonly firefoxRegistry: ProtocolRegistry;

    private readonly output: Output;

    private isFirefoxInstalled?: boolean;

    public constructor({macOsRegistry, firefoxRegistry, output}: Configuration) {
        this.macOsRegistry = macOsRegistry;
        this.firefoxRegistry = firefoxRegistry;
        this.output = output;
    }

    public isRegistered(protocol: string): Promise<boolean> {
        return this.macOsRegistry.isRegistered(protocol);
    }

    public async register(handler: ProtocolHandler): Promise<void> {
        if (this.isFirefoxInstalled === undefined) {
            this.isFirefoxInstalled = await this.firefoxRegistry.isRegistered(handler.protocol);
        }

        await this.macOsRegistry.register(handler);

        try {
            await this.firefoxRegistry.register(handler);
        } catch (error) {
            if (!(error instanceof ProtocolRegistryError) || error.reason !== ErrorReason.NOT_FOUND) {
                throw error;
            }

            // Ignore if Firefox is not installed
            return;
        }

        if (!this.isFirefoxInstalled) {
            this.output.inform('**Firefox detected:** launch or restart it to finish the registration.');
        }
    }

    public async unregister(protocol: string): Promise<void> {
        this.isFirefoxInstalled = await this.firefoxRegistry.isRegistered(protocol);

        await this.macOsRegistry.unregister(protocol);
        await this.firefoxRegistry.unregister(protocol);
    }
}
