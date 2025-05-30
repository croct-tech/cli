import {Minimatch} from 'minimatch';
import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {FileSystem, FileSystemEntry, FileSystemIterator} from '@/application/fs/fileSystem';
import {ResourceProvider} from '@/application/provider/resource/resourceProvider';
import {ErrorReason} from '@/application/error';
import {Input} from '@/application/cli/io/input';
import {resolveUrl} from '@/utils/resolveUrl';
import {Codemod} from '@/application/project/code/transformation/codemod';

export type DownloadOptions = {
    source: string,
    filter?: string,
    destination: string,
    mapping?: Record<string, string>,
    overwrite?: boolean,
    result?: {
        destination?: string,
    },
};

export type Configuration = {
    fileSystem: FileSystem,
    provider: ResourceProvider<FileSystemIterator>,
    codemod: Codemod<string>,
};

export class DownloadAction implements Action<DownloadOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: DownloadOptions, context: ActionContext): Promise<void> {
        const {fileSystem} = this.config;
        const {input} = context;

        const sourceUrl = resolveUrl(options.source, context.baseUrl);

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
            await this.download(sourceUrl, {...options, destination: destination}, input);
        } finally {
            notifier?.stop();
        }

        if (options.result?.destination !== undefined) {
            context.set(options.result.destination, destination);
        }
    }

    private async download(url: URL, options: DownloadOptions, input?: Input): Promise<void> {
        const {provider, fileSystem, codemod} = this.config;
        const {destination, overwrite = false} = options;
        const matcher = options.filter !== undefined
            ? new Minimatch(options.filter)
            : undefined;

        const {value: iterator} = await provider.get(url);

        const entries: FileSystemEntry[] = [];

        const mapping = Object.fromEntries(
            Object.entries(options.mapping ?? {}).map(
                ([key, value]) => [
                    fileSystem.normalizeSeparators(key),
                    fileSystem.normalizeSeparators(value),
                ],
            ),
        );

        for await (const entry of iterator) {
            const path = this.resolvePath(fileSystem.normalizeSeparators(entry.name), mapping);

            if (fileSystem.isAbsolutePath(path)) {
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

        await this.createDirectory(entries, destination, overwrite, input);

        for (const entry of entries) {
            await fileSystem.createDirectory(fileSystem.getDirectoryName(entry.name), {
                recursive: true,
            });

            await fileSystem.create(entry);
        }

        for (const entry of entries) {
            if (entry.type === 'file') {
                await codemod.apply(await fileSystem.getRealPath(entry.name));
            }
        }
    }

    private resolvePath(path: string, mapping: Record<string, string>): string {
        if (path in mapping) {
            return mapping[path];
        }

        const {fileSystem} = this.config;

        let longestPrefix: string = '';
        let newPath: string = path;

        const separator = fileSystem.getSeparator();

        for (const [key, value] of Object.entries(mapping)) {
            const prefix = key.endsWith(separator) ? key : key + separator;

            if (path.startsWith(prefix) && prefix.length > longestPrefix.length) {
                longestPrefix = prefix;
                newPath = fileSystem.joinPaths(value, path.slice(prefix.length));
            }
        }

        return newPath;
    }

    private async createDirectory(
        entries: FileSystemEntry[],
        destination: string,
        overwrite: boolean,
        input?: Input,
    ): Promise<void> {
        const {fileSystem} = this.config;

        if (!await fileSystem.exists(destination)) {
            return fileSystem.createDirectory(destination, {
                recursive: true,
            });
        }

        if (entries.length === 1 && entries[0].type === 'file') {
            if (
                !overwrite
                && await fileSystem.exists(entries[0].name)
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

            return;
        }

        if (!await fileSystem.isDirectory(destination)) {
            if (
                await input?.confirm({
                    message: `Destination ${destination} is not a directory. Do you want to delete it?`,
                    default: false,
                }) !== true
            ) {
                throw new ActionError('Destination is not a directory.', {
                    reason: ErrorReason.PRECONDITION,
                    details: [`Path: ${destination}`],
                    suggestions: ['Delete the file'],
                });
            }
        } else if (
            !overwrite
            && !await fileSystem.isEmptyDirectory(destination)
            && await input?.confirm({
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

        await fileSystem.createDirectory(destination, {
            recursive: true,
        });
    }
}
