import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';

type Replacement = {
    pattern: string,
    caseSensitive?: boolean,
    value: string,
};

type FileMatcher = {
    path: string,
    replacements: Replacement[],
};

export type ReplaceFileContentOptions = {
    files: FileMatcher[],
};

export type Configuration = {
    fileSystem: FileSystem,
};

export class ReplaceFileContentAction implements Action<ReplaceFileContentOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: ReplaceFileContentOptions): Promise<void> {
        const {fileSystem} = this.config;

        for (const {path, replacements} of options.files) {
            if (!await fileSystem.exists(path)) {
                continue;
            }

            try {
                await fileSystem.writeTextFile(
                    path,
                    this.replaceContent(await fileSystem.readTextFile(path), replacements),
                    {overwrite: true},
                );
            } catch (error) {
                throw ActionError.fromCause(error);
            }
        }
    }

    private replaceContent(content: string, replacements: Replacement[]): string {
        let result = content;

        for (const {pattern, caseSensitive, value} of replacements) {
            const flags = caseSensitive === true ? 'i' : undefined;

            result = result.replace(new RegExp(pattern, flags), value);
        }

        return result;
    }
}
