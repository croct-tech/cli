import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason} from '@/application/error';

type Replacement = {
    pattern: string,
    caseSensitive?: boolean,
    value: string|number,
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
        let matched = false;

        for (const {path, replacements} of options.files) {
            const normalizedPath = this.fileSystem.normalizeSeparators(path);

            if (!await this.fileSystem.exists(normalizedPath)) {
                continue;
            }

            matched = true;

            try {
                await this.fileSystem.writeTextFile(
                    normalizedPath,
                    this.replaceContent(await this.fileSystem.readTextFile(normalizedPath), replacements),
                    {overwrite: true},
                );
            } catch (error) {
                throw ActionError.fromCause(error);
            }
        }

        if (!matched) {
            throw new ActionError('No files matched for content replacement.', {
                reason: ErrorReason.UNEXPECTED_RESULT,
            });
        }
    }

    private replaceContent(content: string, replacements: Replacement[]): string {
        let result = content;

        for (const {pattern, caseSensitive, value} of replacements) {
            const flags = caseSensitive === true ? 'gi' : 'g';

            result = result.replace(new RegExp(pattern, flags), `${value}`);
        }

        return result;
    }
}
