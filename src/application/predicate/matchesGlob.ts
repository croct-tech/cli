import {Minimatch} from 'minimatch';
import {Predicate} from '@/application/predicate/predicate';

export class MatchesGlob implements Predicate<[string, string]> {
    private readonly matcher: Minimatch;

    public constructor(matcher: Minimatch) {
        this.matcher = matcher;
    }

    public static fromPattern(pattern: string): MatchesGlob {
        return new MatchesGlob(
            new Minimatch(
                pattern.replace(/^\.\//, '')
                    .replace(/\\/g, '/'),
            ),
        );
    }

    public test(path: string): Promise<boolean> {
        return Promise.resolve(this.matcher.match(path));
    }
}
