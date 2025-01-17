import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason} from '@/application/error';

type PatternMatcher = {
    pattern: string,
    caseSensitive?: boolean,
};

type CombinationMatcher = {
    type: 'and' | 'or',
    matchers: PatternMatcher[],
};

type Matcher = PatternMatcher | CombinationMatcher;

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

export class LocateFile implements Action<LocateFileOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: LocateFileOptions, context: ActionContext): Promise<void> {
        const pattern = await context.resolveString(options.path);
        const matches = await this.findMatch(pattern, options, context);

        if (matches.length === 0) {
            throw new ActionError('No matching files found', {
                reason: ErrorReason.PRECONDITION,
                details: [`Pattern: ${pattern}`],
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

    private async findMatch(path: string, options: LocateFileOptions, context: ActionContext): Promise<string[]> {
        const {fileSystem} = this.config;

        const matches: string[] = [];

        for await (const file of fileSystem.find(path)) {
            if (options.matcher === undefined) {
                matches.push(file.name);
            } else if (file.type === 'file') {
                const content = await new Response(file.content).text();

                if (await this.matches(content, options.matcher, context)) {
                    matches.push(file.name);
                }
            }

            if (options.max !== undefined && matches.length >= options.max) {
                break;
            }
        }

        return matches;
    }

    private async matches(content: string, matcher: Matcher, context: ActionContext): Promise<boolean> {
        if ('pattern' in matcher) {
            const pattern = await context.resolveString(matcher.pattern);

            const flags = matcher.caseSensitive === true ? 'i' : undefined;

            return new RegExp(pattern, flags).test(content);
        }

        switch (matcher.type) {
            case 'and':
                return matcher.matchers.every(subMatcher => this.matches(content, subMatcher, context));

            case 'or':
                return matcher.matchers.some(subMatcher => this.matches(content, subMatcher, context));
        }
    }
}

declare module '@/application/template/action/action' {
    export interface ActionOptionsMap {
        'locate-file': LocateFileOptions;
    }
}
