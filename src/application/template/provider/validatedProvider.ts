import {ResourceProvider, ResourceProviderError, ProviderOptions} from '@/application/provider/resourceProvider';
import {Validator} from '@/application/validation';

export type Configuration<I, R, O extends ProviderOptions> = {
    provider: ResourceProvider<R, O>,
    validator: Validator<I>,
};

export class ValidatedProvider<I, R, O extends ProviderOptions> implements ResourceProvider<I, O> {
    private readonly provider: ResourceProvider<R>;

    private readonly validator: Validator<I>;

    public constructor({provider, validator}: Configuration<I, R, O>) {
        this.provider = provider;
        this.validator = validator;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL, options: O): Promise<I> {
        const data = await this.provider.get(url, options);
        const result = this.validator.validate(data);

        if (!result.valid) {
            throw new ResourceProviderError('The response data is invalid.', url, {
                details: result.violations.map(violation => violation.message),
            });
        }

        return result.data;
    }
}
