import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';

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
    private readonly fileSystem: FileSystem;

    public constructor({fileSystem}: Configuration) {
        this.fileSystem = fileSystem;
    }

    public async execute(options: ReplaceFileContentOptions, context: ActionContext): Promise<void> {
        const {output} = context;
        const notifier = output.notify('Replacing file content');

        try {
            await this.replaceFiles(options);
        } finally {
            notifier.stop();
        }
    }

    private async replaceFiles(options: ReplaceFileContentOptions): Promise<void> {
        for (const {path, replacements} of options.files) {
            if (!await this.fileSystem.exists(path)) {
                continue;
            }

            try {
                await this.fileSystem.writeTextFile(
                    path,
                    this.replaceContent(await this.fileSystem.readTextFile(path), replacements),
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
