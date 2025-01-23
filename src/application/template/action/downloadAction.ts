import {Minimatch} from 'minimatch';
import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {FileSystem, FileSystemIterator} from '@/application/fs/fileSystem';
import {Provider} from '@/application/template/provider/provider';
import {ErrorReason} from '@/application/error';

export type DownloadOptions = {
    source: string,
    filter?: string,
    destination: string,
    output?: {
        destination?: string,
    },
};

export type Configuration = {
    fileSystem: FileSystem,
    provider: Provider<FileSystemIterator>,
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

        const {destination} = options;

        if (await fileSystem.exists(destination)) {
            if (!await fileSystem.isDirectory(destination) || !await fileSystem.isEmptyDirectory(destination)) {
                if (
                    await input?.confirm({
                        message: 'Destination directory is not empty. Do you want to clear it?',
                        default: false,
                    }) !== true
                ) {
                    throw new ActionError('Destination directory is not empty.', {
                        reason: ErrorReason.PRECONDITION,
                        suggestions: [
                            'Clear the directory or choose another destination.',
                        ],
                    });
                }

                await fileSystem.delete(destination, {recursive: true});
            }
        }

        await fileSystem.createDirectory(destination, {
            recursive: true,
        });

        const destinationPath = fileSystem.normalizeSeparators(destination);

        const {output} = context;

        const notifier = output?.notify('Downloading sources');

        await this.download(
            sourceUrl,
            destination,
            options.filter !== undefined
                ? new Minimatch(options.filter)
                : undefined,
        );

        notifier?.stop();

        if (options.output?.destination !== undefined) {
            context.set(options.output.destination, destinationPath);
        }
    }

    private async download(url: URL, destination: string, matcher?: Minimatch): Promise<void> {
        const {provider, fileSystem} = this.config;

        const iterator = await provider.get(url);

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
