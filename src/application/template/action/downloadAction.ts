import {Minimatch} from 'minimatch';
import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {FileSystem, FileSystemEntry, FileSystemIterator} from '@/application/fs/fileSystem';
import {ResourceProvider} from '@/application/provider/resourceProvider';
import {ErrorReason} from '@/application/error';
import {Input} from '@/application/cli/io/input';

export type DownloadOptions = {
    source: string,
    filter?: string,
    destination: string,
    result?: {
        destination?: string,
    },
};

export type Configuration = {
    fileSystem: FileSystem,
    provider: ResourceProvider<FileSystemIterator>,
};

export class DownloadAction implements Action<DownloadOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: DownloadOptions, context: ActionContext): Promise<void> {
        const {fileSystem} = this.config;
        const {input} = context;

        const sourceUrl = DownloadAction.getSourceUrl(options.source, context.baseUrl);

        if (sourceUrl.protocol === 'file:' && context.baseUrl.protocol !== 'file:') {
            throw new ActionError('File URL is not allowed from remote sources for security reasons.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Source URL: ${sourceUrl}`,
                ],
            });
        }

        const destination = fileSystem.normalizeSeparators(options.destination);

        const {output} = context;

        const notifier = output?.notify('Downloading sources');

        try {
            await this.download(
                sourceUrl,
                destination,
                options.filter !== undefined
                    ? new Minimatch(options.filter)
                    : undefined,
                input,
            );
        } finally {
            notifier?.stop();
        }

        if (options.result?.destination !== undefined) {
            context.set(options.result.destination, destination);
        }
    }

    private async download(url: URL, destination: string, matcher?: Minimatch, input?: Input): Promise<void> {
        const {provider, fileSystem} = this.config;

        const {value: iterator} = await provider.get(url);

        const entries: FileSystemEntry[] = [];

        for await (const entry of iterator) {
            const path = fileSystem.normalizeSeparators(entry.name);

            if (fileSystem.isAbsolutePath(path) || !fileSystem.isSubPath(destination, path)) {
                // Disallow linking outside the destination directory for security reasons
                continue;
            }

            if (matcher !== undefined && !matcher.match(path)) {
                continue;
            }

            entry.name = fileSystem.joinPaths(destination, path);

            if (entry.type === 'link' || entry.type === 'symlink') {
                const target = fileSystem.normalizeSeparators(entry.target);

                if (fileSystem.isAbsolutePath(target) || !fileSystem.isSubPath(destination, target)) {
                    // Disallow linking outside the destination directory for security reasons
                    continue;
                }

                entry.target = target;
            }

            entries.push(entry);
        }

        if (entries.length === 0) {
            return;
        }

        if (await fileSystem.exists(destination)) {
            if (entries.length === 1 && entries[0].type === 'file') {
                if (
                    await fileSystem.exists(entries[0].name)
                    && await input?.confirm({
                        message: `File ${entries[0].name} already exists. Do you want to overwrite it?`,
                        default: false,
                    }) !== true
                ) {
                    throw new ActionError('Destination file already exists.', {
                        reason: ErrorReason.PRECONDITION,
                        details: [`File: ${entries[0].name}`],
                        suggestions: ['Delete the file'],
                    });
                }
            } else if (!await fileSystem.isDirectory(destination) || !await fileSystem.isEmptyDirectory(destination)) {
                if (
                    await input?.confirm({
                        message: `Directory ${destination} is not empty. Do you want to clear it?`,
                        default: false,
                    }) !== true
                ) {
                    throw new ActionError('Destination directory is not empty.', {
                        reason: ErrorReason.PRECONDITION,
                        details: [`Directory: ${destination}`],
                        suggestions: ['Clear the directory'],
                    });
                }

                await fileSystem.delete(destination, {recursive: true});
            }
        }

        await fileSystem.createDirectory(destination, {
            recursive: true,
        });

        for (const entry of entries) {
            await fileSystem.create(entry);
        }
    }

    private static getSourceUrl(source: string, baseUrl: URL): URL {
        if (URL.canParse(source)) {
            return new URL(source);
        }

        const url = new URL(baseUrl);

        url.pathname = `${url.pathname.replace(/\/([^/]*\.[^/]+)?$/, '')}/${source}`;

        return url;
    }
}
