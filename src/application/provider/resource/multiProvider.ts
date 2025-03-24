import {
    Resource,
    ResourceNotFoundError,
    ResourceProvider,
    ResourceProviderError,
} from '@/application/provider/resource/resourceProvider';
import {ErrorReason} from '@/application/error';

export class MultiProvider<T> implements ResourceProvider<T> {
    private static readonly EXPECTED_ERROR_REASONS: ErrorReason[] = [
        ErrorReason.NOT_SUPPORTED,
        ErrorReason.NOT_FOUND,
    ];

    private readonly providers: Array<ResourceProvider<T>>;

    public constructor(...providers: Array<ResourceProvider<T>>) {
        this.providers = providers;
    }

    public async get(url: URL): Promise<Resource<T>> {
        for (const provider of this.providers) {
            try {
                return await provider.get(url);
            } catch (error) {
                if (!MultiProvider.isExpectedError(error)) {
                    throw error;
                }
            }
        }

        throw new ResourceNotFoundError('Resource not found.', {url: url});
    }

    private static isExpectedError(error: unknown): boolean {
        return error instanceof ResourceProviderError
            && MultiProvider.EXPECTED_ERROR_REASONS.includes(error.reason);
    }
}
