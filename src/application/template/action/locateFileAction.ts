import {Action} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {Provider} from '@/application/provider/provider';
import {Predicate} from '@/application/predicate/predicate';

export type PatternMatcher = {
    pattern: string,
    caseSensitive?: boolean,
};

export type CombinationMatcher = {
    type: 'and' | 'or',
    matchers: ContentMatcher[],
};

export type ContentMatcher = PatternMatcher | CombinationMatcher;

export type LocateFileOptions = {
    path: string,
    matcher?: ContentMatcher,
    max?: number,
    result?: string,
};

export type PathMatcher = Predicate<[string]>;

export type Configuration = {
    projectDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    matcherProvider: Provider<PathMatcher, [string]>,
};

export class LocateFileAction implements Action<LocateFileOptions> {
    private readonly projectDirectory: WorkingDirectory;

    private readonly fileSystem: FileSystem;

    private readonly matcherProvider: Provider<PathMatcher, [string]>;

    public constructor({projectDirectory, fileSystem, matcherProvider}: Configuration) {
        this.projectDirectory = projectDirectory;
        this.fileSystem = fileSystem;
        this.matcherProvider = matcherProvider;
    }

    public async execute(options: LocateFileOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Locating files');

        try {
            await this.findMatches(options, context);
        } finally {
            notifier?.stop();
        }
    }

    private async findMatches(options: LocateFileOptions, context: ActionContext): Promise<void> {
        const matches = await this.findMatch(options.path, options);

        if (options.result !== undefined) {
            context.set(options.result, matches);
        }
    }

    private async findMatch(pattern: string, options: LocateFileOptions): Promise<string[]> {
        const filter = await this.matcherProvider.get(pattern);

        const matches: string[] = [];

        for await (const file of this.fileSystem.list(this.projectDirectory.get(), true)) {
            if (!await filter.test(file.name)) {
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

            if (options.max !== undefined && matches.length >= options.max) {
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
