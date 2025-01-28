import {Minimatch} from 'minimatch';
import {Action} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';

export type PatternMatcher = {
    pattern: string,
    caseSensitive?: boolean,
};

export type CombinationMatcher = {
    type: 'and' | 'or',
    matchers: Matcher[],
};

export type Matcher = PatternMatcher | CombinationMatcher;

export type LocateFileOptions = {
    path: string,
    matcher?: Matcher,
    max?: number,
    result?: {
        paths?: string,
        extensions?: string,
    },
};

export type Configuration = {
    projectDirectory: string,
    fileSystem: FileSystem,
};

export class LocateFileAction implements Action<LocateFileOptions> {
    private readonly projectDirectory: string;

    private readonly fileSystem: FileSystem;

    public constructor({projectDirectory, fileSystem}: Configuration) {
        this.projectDirectory = projectDirectory;
        this.fileSystem = fileSystem;
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
            const variables = options.result;

            if (variables.paths !== undefined) {
                context.set(variables.paths, matches);
            }

            if (variables.extensions !== undefined) {
                const extensions = matches.map(file => {
                    const baseName = this.fileSystem.getBaseName(file);

                    return baseName.split('.').pop() ?? '';
                });

                context.set(variables.extensions, extensions);
            }
        }
    }

    private async findMatch(pattern: string, options: LocateFileOptions): Promise<string[]> {
        const filter = new Minimatch(pattern);

        const matches: string[] = [];

        for await (const file of this.fileSystem.list(this.projectDirectory, true)) {
            if (!filter.match(file.name)) {
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

    private matches(content: string, matcher: Matcher): boolean {
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
