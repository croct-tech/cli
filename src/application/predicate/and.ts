import {Predicate} from '@/application/predicate/predicate';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    fileSystem: FileSystem,
    files: string[],
};

export class And implements Predicate {
    private readonly predicates: Predicate[];

    public constructor(predicates: Predicate[]) {
        this.predicates = predicates;
    }

    public async test(): Promise<boolean> {
        return (await Promise.all(this.predicates.map(predicate => predicate.test()))).every(result => result);
    }
}
