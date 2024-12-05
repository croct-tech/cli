import {Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {CliError, CliErrorCode} from '@/application/cli/error';

export type SdkDetectorConfiguration = {
    resolvers: Array<SdkResolver<Sdk|null>>,
};

export class SdkDetector implements SdkResolver {
    private readonly resolvers: Array<SdkResolver<Sdk|null>>;

    public constructor(config: SdkDetectorConfiguration) {
        this.resolvers = config.resolvers;
    }

    public async resolve(hint?: string): Promise<Sdk> {
        const sdk = await this.detect(hint);

        if (sdk === null) {
            throw new CliError('No supported SDK found.', {
                code: CliErrorCode.PRECONDITION,
            });
        }

        return sdk;
    }

    private async detect(hint?: string): Promise<Sdk | null> {
        for (const resolver of this.resolvers) {
            const sdk = await resolver.resolve(hint);

            if (sdk !== null) {
                return sdk;
            }
        }

        return null;
    }
}
