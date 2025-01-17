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
        destination: string,
    },
};

export type Configuration = {
    fileSystem: FileSystem,
    provider: Provider<FileSystemIterator>,
};

export class Download implements Action<DownloadOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: DownloadOptions, context: ActionContext): Promise<void> {
        const {fileSystem} = this.config;
        const {input} = context;

        const [source, destination] = await Promise.all([
            context.resolveString(options.source),
            context.resolveString(options.destination),
        ]);

        const baseUrl = context.getBaseUrl();
        const sourceUrl = Download.getSourceUrl(source, baseUrl);

        if (sourceUrl.protocol === 'file:' && baseUrl.protocol !== 'file:') {
            throw new ActionError('File URL is not allowed from remote sources for security reasons.', {
                reason: ErrorReason.PRECONDITION,
                suggestions: [
                    `Source URL: ${source}`,
                ],
            });
        }

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

        await fileSystem.createDirectory(destination);

        const destinationPath = fileSystem.normalizeSeparators(destination);

        const {output} = context;

        const notifier = output?.notify('Downloading sources');

        await this.downloadFile(sourceUrl, destination);

        notifier?.stop();

        if (options.output !== undefined) {
            context.set(options.output.destination, destinationPath);
        }
    }

    private async downloadFile(url: URL, destination: string): Promise<void> {
        const {provider, fileSystem} = this.config;

        const iterator = await provider.get(url);

        for await (const entry of iterator) {
            const path = fileSystem.normalizeSeparators(entry.name);

            if (fileSystem.isAbsolutePath(path) || !fileSystem.isSubPath(destination, path)) {
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

        url.pathname = `${url.pathname.replace(/\/$/, '')}/${source}`;

        return url;
    }
}

declare module '@/application/template/action/action' {
    export interface ActionOptionsMap {
        'download': DownloadOptions;
    }
}
