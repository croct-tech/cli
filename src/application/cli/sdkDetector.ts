import {Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {Output} from '@/application/cli/io/output';
import {ApplicationPlatform} from '@/application/model/entities';

export type SdkDetectorConfiguration = {
    resolvers: Array<SdkResolver<Sdk|null>>,
    output: Output,
};

export class SdkDetector implements SdkResolver {
    private readonly output: Output;

    private readonly resolvers: Array<SdkResolver<Sdk|null>>;

    public constructor(config: SdkDetectorConfiguration) {
        this.output = config.output;
        this.resolvers = config.resolvers;
    }

    public async resolve(hint?: string): Promise<Sdk> {
        const notifier = this.output.notify('Resolving SDK');

        const sdk = await this.detect(hint);

        if (sdk === null) {
            notifier.alert('No supported SDK found.');

            return this.output.exit();
        }

        notifier.stop();

        this.output.inform(`Using ${ApplicationPlatform.getName(sdk.getPlatform())} SDK`);

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
