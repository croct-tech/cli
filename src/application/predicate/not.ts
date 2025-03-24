import {Predicate} from '@/application/predicate/predicate';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    fileSystem: FileSystem,
    files: string[],
};

export class Not<A extends any[]> implements Predicate<A> {
    private readonly predicate: Predicate<A>;

    public constructor(predicate: Predicate<A>) {
        this.predicate = predicate;
    }

    public async test(...args: A): Promise<boolean> {
        return !(await this.predicate.test(...args));
    }
}
