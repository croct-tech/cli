import {Provider, ProviderError} from '@/application/provider/provider';
import {CodeFormatter} from '@/application/project/code/formatting/formatter';
import {PackageManagerError} from '@/application/project/packageManager/packageManager';

export class LazyFormatter implements CodeFormatter {
    private readonly provider: Provider<CodeFormatter>;

    public constructor(provider: Provider<CodeFormatter>) {
        this.provider = provider;
    }

    public async format(files: string[]): Promise<void> {
        return (await this.formatter).format(files);
    }

    private get formatter(): Promise<CodeFormatter> {
        return Promise.resolve(this.provider.get()).catch(error => {
            if (error instanceof ProviderError) {
                throw new PackageManagerError(error.message, error.help);
            }

            throw error;
        });
    }
}
