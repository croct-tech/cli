import {Provider} from '@/application/provider/provider';
import {Predicate} from '@/application/predicate/predicate';

export class PredicateProvider<A extends any[]> implements Provider<boolean, A> {
    private readonly predicate: Predicate<A>;

    public constructor(predicate: Predicate<A>) {
        this.predicate = predicate;
    }

    public get(...args: A): Promise<boolean> | boolean {
        return this.predicate.test(...args);
    }
}
