import {Action} from '@/application/template/action/action';
import {FileSystem, ScanFilter} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {MatchesGlob} from '@/application/predicate/matchesGlob';

export type PatternMatcher = {
    pattern: string,
    caseSensitive?: boolean,
};

export type CombinationMatcher = {
    type: 'and' | 'or',
    matchers: ContentMatcher[],
};

export type ContentMatcher = PatternMatcher | CombinationMatcher;

export type LocatePathOptions = {
    path: string,
    matcher?: ContentMatcher,
    limit?: number,
    depth?: number,
    result: string,
};

export type Configuration = {
    projectDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    scanFilter?: ScanFilter,
};

export class LocatePathAction implements Action<LocatePathOptions> {
    private readonly projectDirectory: WorkingDirectory;

    private readonly fileSystem: FileSystem;

    private readonly scanFilter?: ScanFilter;

    public constructor({projectDirectory, fileSystem, scanFilter}: Configuration) {
        this.projectDirectory = projectDirectory;
        this.fileSystem = fileSystem;
        this.scanFilter = scanFilter;
    }

    public async execute(options: LocatePathOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Locating files');

        try {
            await this.findMatches(options, context);
        } finally {
            notifier?.stop();
        }
    }

    private async findMatches(options: LocatePathOptions, context: ActionContext): Promise<void> {
        context.set(options.result, await this.findMatch(options.path, options));
    }

    private async findMatch(pattern: string, options: LocatePathOptions): Promise<string[]> {
        const filter: ScanFilter = (path, depth) => {
            if (options.depth !== undefined && depth > options.depth) {
                return false;
            }

            if (this.scanFilter !== undefined) {
                return this.scanFilter(path, depth);
            }

            return true;
        };

        const matches: string[] = [];
        const matcher = MatchesGlob.fromPattern(pattern);

        for await (const file of this.fileSystem.list(this.projectDirectory.get(), filter)) {
            if (!await matcher.test(file.name)) {
                continue;
            }

            if (options.matcher === undefined) {
                matches.push(file.name);
            } else if (file.type === 'file') {
                const content = await new Response(file.content).text();

                if (this.matches(content, options.matcher)) {
                    matches.push(file.name);
                }
            }

            if (options.limit !== undefined && matches.length >= options.limit) {
                break;
            }
        }

        return matches;
    }

    private matches(content: string, matcher: ContentMatcher): boolean {
        if ('pattern' in matcher) {
            return new RegExp(matcher.pattern, matcher.caseSensitive === true ? 'i' : undefined).test(content);
        }

        switch (matcher.type) {
            case 'and':
                return matcher.matchers.every(subMatcher => this.matches(content, subMatcher));

            case 'or':
                return matcher.matchers.some(subMatcher => this.matches(content, subMatcher));
        }
    }
}
