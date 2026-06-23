import type {Installation, Sdk, UpdateOptions} from '@/application/project/sdk/sdk';
import {SdkError} from '@/application/project/sdk/sdk';
import type {Provider} from '@/application/provider/provider';
import {ProviderError} from '@/application/provider/provider';
import type {ProjectConfiguration, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import type {Slot} from '@/application/model/slot';

export class LazySdk implements Sdk {
    private readonly provider: Provider<Sdk>;

    public constructor(provider: Provider<Sdk>) {
        this.provider = provider;
    }

    private get sdk(): Promise<Sdk> {
        return Promise.resolve(this.provider.get()).catch(error => {
            if (error instanceof ProviderError) {
                throw new SdkError(error.message, error.help);
            }

            throw error;
        });
    }

    public async setup(installation: Installation): Promise<ProjectConfiguration> {
        return (await this.sdk).setup(installation);
    }

    public async getPaths(configuration: ProjectConfiguration): Promise<ProjectPaths> {
        return (await this.sdk).getPaths(configuration);
    }

    public async update(installation: Installation, options?: UpdateOptions): Promise<void> {
        return (await this.sdk).update(installation, options);
    }

    public async generateSlotExample(slot: Slot, installation: Installation): Promise<void> {
        return (await this.sdk).generateSlotExample(slot, installation);
    }

    public async presentExamples(slots: Slot[], installation: Installation): Promise<void> {
        return (await this.sdk).presentExamples?.(slots, installation);
    }
}
