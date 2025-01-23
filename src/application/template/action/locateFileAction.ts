import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason} from '@/application/error';

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
    output?: {
        path?: string,
        extension?: string,
    },
};

export type Configuration = {
    fileSystem: FileSystem,
};

export class LocateFileAction implements Action<LocateFileOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: LocateFileOptions, context: ActionContext): Promise<void> {
        const matches = await this.findMatch(options.path, options);

        if (matches.length === 0) {
            throw new ActionError('No matching files found', {
                reason: ErrorReason.PRECONDITION,
                details: [`Pattern: ${options.path}`],
            });
        }

        if (options.output !== undefined) {
            const variables = options.output;

            if (variables.path !== undefined) {
                context.set(variables.path, matches);
            }

            if (variables.extension !== undefined) {
                const extensions = matches.map(file => {
                    const baseName = this.config
                        .fileSystem
                        .getBaseName(file);

                    return baseName.split('.').pop() ?? '';
                });

                context.set(variables.extension, extensions);
            }
        }
    }

    private async findMatch(path: string, options: LocateFileOptions): Promise<string[]> {
        const {fileSystem} = this.config;

        const matches: string[] = [];

        for await (const file of fileSystem.find(path)) {
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
