import {Predicate} from '@/application/predicate/predicate';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    fileSystem: FileSystem,
    files: string[],
};

export class And<A extends any[]> implements Predicate<A> {
    private readonly predicates: Array<Predicate<A>>;

    public constructor(...predicates: Array<Predicate<A>>) {
        this.predicates = predicates;
    }

    public async test(...args: A): Promise<boolean> {
        for (const predicate of this.predicates) {
            if (!(await predicate.test(...args))) {
                return false;
            }
        }

        return true;
    }
}
