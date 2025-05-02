import {
    Resource,
    ResourceNotFoundError,
    ResourceProvider,
    ResourceProviderError,
} from '@/application/provider/resource/resourceProvider';
import {ErrorReason} from '@/application/error';

export type Configuration<T> = {
    providers: Array<ResourceProvider<T>>,
    expectedErrors?: ErrorReason[],
};

export class MultiProvider<T> implements ResourceProvider<T> {
    private static readonly DEFAULT_EXPECTED_ERRORS: ErrorReason[] = [
        ErrorReason.NOT_SUPPORTED,
        ErrorReason.NOT_FOUND,
    ];

    private readonly providers: Array<ResourceProvider<T>>;

    private readonly expectedErrors: ErrorReason[];

    public constructor({providers, expectedErrors}: Configuration<T>) {
        this.providers = providers;
        this.expectedErrors = expectedErrors ?? MultiProvider.DEFAULT_EXPECTED_ERRORS;
    }

    public async get(url: URL): Promise<Resource<T>> {
        for (const provider of this.providers) {
            try {
                return await provider.get(url);
            } catch (error) {
                if (!this.isExpectedError(error)) {
                    throw error;
                }
            }
        }

        throw new ResourceNotFoundError('Resource not found.', {url: url});
    }

    private isExpectedError(error: unknown): boolean {
        return error instanceof ResourceProviderError
            && this.expectedErrors.includes(error.reason);
    }
}
