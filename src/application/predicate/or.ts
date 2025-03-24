import {Predicate} from '@/application/predicate/predicate';

export class Or<A extends any[]> implements Predicate<A> {
    private readonly predicates: Array<Predicate<A>>;

    public constructor(...predicates: Array<Predicate<A>>) {
        this.predicates = predicates;
    }

    public async test(...args: A): Promise<boolean> {
        for (const predicate of this.predicates) {
            if (await predicate.test(...args)) {
                return true;
            }
        }

        return false;
    }
}
