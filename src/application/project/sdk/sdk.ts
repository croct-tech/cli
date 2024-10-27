import {ApplicationPlatform} from '@/application/model/entities';
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
    updateTypes(installation: Installation): Promise<void>;
    updateContent(installation: Installation): Promise<void>;
}

export interface SdkResolver {
    resolve(hint?: string): Promise<Sdk|null>;
}

export class SequentialSdkResolver implements SdkResolver {
    private readonly resolvers: SdkResolver[];

    public constructor(resolvers: SdkResolver[]) {
        this.resolvers = resolvers;
    }

    public async resolve(hint?: string): Promise<Sdk|null> {
        for (const resolver of this.resolvers) {
            const sdk = await resolver.resolve(hint);

            if (sdk !== null) {
                return sdk;
            }
        }

        return null;
    }
}

export class SdkError extends Error {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, SdkError.prototype);
    }
}

export class SdkInstallationError extends SdkError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, SdkInstallationError.prototype);
    }
}
