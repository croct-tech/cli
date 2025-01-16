import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';

type Replacement = {
    pattern: string,
    caseSensitive?: boolean,
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
                await fileSystem.writeTextFile(
                    resolvedPath,
                    this.replaceContent(
                        ...await Promise.all([
                            fileSystem.readTextFile(resolvedPath),
                            context.resolveString(replacements),
                        ]),
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

declare module '@/application/template/action/action' {
    export interface ActionOptionsMap {
        'replace-file-content': ReplaceFileContentOptions;
    }
}
