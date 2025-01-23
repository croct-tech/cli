import {Provider, ProviderError, ProviderOptions} from '@/application/template/provider/provider';
import {Validator} from '@/application/validation';

export type Configuration<I, R, O extends ProviderOptions> = {
    provider: Provider<R, O>,
    validator: Validator<I>,
};

export class ValidatedProvider<I, R, O extends ProviderOptions> implements Provider<I, O> {
    private readonly provider: Provider<R>;

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
            throw new ProviderError('The response data is invalid.', url, {
                details: result.violations.map(violation => violation.message),
            });
        }

        return result.data;
    }
}
