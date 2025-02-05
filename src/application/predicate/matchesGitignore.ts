import ignore from 'ignore';
import type {Ignore as Gitignore} from 'ignore';
import {Predicate} from '@/application/predicate/predicate';

export class MatchesGitignore implements Predicate<[string]> {
    private readonly filter: Gitignore;

    public constructor(filter: Gitignore) {
        this.filter = filter;
    }

    public static fromPatterns(...patterns: string[]): MatchesGitignore {
        return new MatchesGitignore(ignore().add(patterns));
    }

    public test(path: string): Promise<boolean> {
        return Promise.resolve(this.filter.ignores(path));
    }
}
