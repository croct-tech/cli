import {Provider} from '@/application/provider/provider';
import {Predicate} from '@/application/predicate/predicate';

type Candidate<T, A extends any[]> ={
    condition: Predicate<A>,
    value: T|Provider<T, A>,
};

export type Configuration<T, A extends any[]> = {
    candidates: Array<Candidate<T, A>>,
};

export class ConditionalProvider<T, A extends any[]> implements Provider<T|null, A> {
    private readonly candidates: Array<Candidate<T, A>>;

    public constructor(configuration: Configuration<T, A>) {
        this.candidates = configuration.candidates;
    }

    public async get(...args: A): Promise<T|null> {
        for (const {condition, value} of this.candidates) {
            try {
                if (await condition.test(...args)) {
                    return typeof value === 'object' && value !== null && 'get' in value
                        ? value.get(...args)
                        : value;
                }
            } catch {
                // ignore
            }
        }

        return null;
    }
}
