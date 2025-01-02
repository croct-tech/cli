import {Action, ActionError} from '@/application/cli/action/action';
import {FileSystem} from '@/application/fileSystem/fileSystem';
import {ActionContext} from '@/application/cli/action/context';

type Replacement = {
    pattern: string,
    caseSensitive?: string|boolean,
    replacement: string,
};

type Replacements = {
    path: string,
    replacements: Replacement[],
};

export type ReplaceFileContentOptions = {
    files: Replacements[],
};

export type Configuration = {
    fileSystem: FileSystem,
};

export class ReplaceFileContent implements Action<ReplaceFileContentOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: ReplaceFileContentOptions, context: ActionContext): Promise<void> {
        const {fileSystem} = this.config;

        for (const {path, replacements} of options.files) {
            const resolvedPath = await context.resolveString(path);

            if (!await fileSystem.exists(resolvedPath)) {
                continue;
            }

            try {
                await fileSystem.writeFile(
                    resolvedPath,
                    this.replaceContent(
                        await fileSystem.readFile(resolvedPath),
                        await Promise.all(
                            replacements.map(
                                async unresolvedReplacement => {
                                    const [pattern, caseSensitive, replacement] = await Promise.all([
                                        context.resolveString(unresolvedReplacement.pattern),
                                        typeof unresolvedReplacement.caseSensitive === 'string'
                                            ? context.resolveBoolean(unresolvedReplacement.caseSensitive)
                                            : unresolvedReplacement.caseSensitive,
                                        context.resolveString(unresolvedReplacement.replacement),
                                    ]);

                                    return {
                                        pattern: pattern,
                                        caseSensitive: caseSensitive,
                                        replacement: replacement,
                                    };
                                },
                            ),
                        ),
                    ),
                    {overwrite: true},
                );
            } catch (error) {
                throw ActionError.fromCause(error);
            }
        }
    }

    private replaceContent(content: string, replacements: Replacement[]): string {
        let result = content;

        for (const {pattern, caseSensitive, replacement} of replacements) {
            const flags = caseSensitive === true ? 'i' : undefined;

            result = result.replace(new RegExp(pattern, flags), replacement);
        }

        return result;
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'replace-file-content': ReplaceFileContentOptions;
    }
}
