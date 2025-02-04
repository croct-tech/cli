import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resourceProvider';
import {Validator} from '@/application/validation';
import {ErrorReason} from '@/application/error';

export type Configuration<I, R> = {
    provider: ResourceProvider<R>,
    validator: Validator<I>,
};

export class ValidatedProvider<I, R> implements ResourceProvider<I> {
    private readonly provider: ResourceProvider<R>;

    private readonly validator: Validator<I>;

    public constructor({provider, validator}: Configuration<I, R>) {
        this.provider = provider;
        this.validator = validator;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL): Promise<Resource<I>> {
        const {value, ...resource} = await this.provider.get(url);
        const validation = await this.validator.validate(value);

        if (!validation.valid) {
            const violations = validation.violations
                .map(violation => ` • **${violation.path}**: ${violation.message}`)
                .join('\n\n');

            throw new ResourceProviderError(`The response data is invalid:\n\n${violations}`, {
                reason: ErrorReason.INVALID_INPUT,
                url: url,
            });
        }

        return {
            ...resource,
            value: validation.data,
        };
    }
}
