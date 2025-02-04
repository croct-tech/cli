import {ImportResolverError, ImportResolver} from '@/application/project/import/importResolver';
import {Provider, ProviderError} from '@/application/provider/provider';

export class LazyImportResolver implements ImportResolver {
    private readonly provider: Provider<ImportResolver>;

    public constructor(provider: Provider<ImportResolver>) {
        this.provider = provider;
    }

    private get resolver(): Promise<ImportResolver> {
        return Promise.resolve(this.provider.get()).catch(error => {
            if (error instanceof ProviderError) {
                throw new ImportResolverError(error.message, error.help);
            }

            throw error;
        });
    }

    public async getImportPath(filePath: string, importPath?: string): Promise<string> {
        return (await this.resolver).getImportPath(filePath, importPath);
    }
}
