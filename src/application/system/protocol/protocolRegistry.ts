import {Help, HelpfulError} from '@/application/error';

export type ProtocolHandler = {
    id: string,
    name: string,
    protocol: string,
    command: string,
};

export class ProtocolRegistryError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, ProtocolRegistryError.prototype);
    }
}

export interface ProtocolRegistry {
    register(handler: ProtocolHandler): Promise<void>;
    unregister(protocol: string): Promise<void>;
    isRegistered(protocol: string): Promise<boolean>;
}
