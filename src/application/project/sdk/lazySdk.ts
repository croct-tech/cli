import {Installation, Sdk, SdkError} from '@/application/project/sdk/sdk';
import {Provider, ProviderError} from '@/application/provider/provider';
import {Configuration} from '@/application/project/configuration/configuration';
import {Slot} from '@/application/model/slot';

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

    public async install(installation: Installation): Promise<Configuration> {
        return (await this.sdk).install(installation);
    }

    public async update(installation: Installation): Promise<void> {
        return (await this.sdk).update(installation);
    }

    public async updateContent(installation: Installation): Promise<void> {
        return (await this.sdk).updateContent(installation);
    }

    public async updateTypes(installation: Installation): Promise<void> {
        return (await this.sdk).updateTypes(installation);
    }

    public async generateSlotExample(slot: Slot, installation: Installation): Promise<void> {
        return (await this.sdk).generateSlotExample(slot, installation);
    }
}
