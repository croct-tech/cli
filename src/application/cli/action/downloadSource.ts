import {Action, ActionError} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';
import {Downloader} from '@/application/cli/download/downloader';
import {FileSystem} from '@/application/fileSystem/fileSystem';
import {CliErrorCode} from '@/application/cli/error';

export type DownloadSourceOptions = {
    source: string,
    destination: string,
    output?: {
        destination: string,
    },
};

export type Configuration = {
    fileSystem: FileSystem,
    downloader: Downloader,
};

export class DownloadSource implements Action<DownloadSourceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: DownloadSourceOptions, context: ActionContext): Promise<void> {
        const {downloader, fileSystem} = this.config;

        const [source, destination] = await Promise.all([
            context.resolveString(options.source),
            context.resolveString(options.destination),
        ]);

        if (!URL.canParse(source)) {
            throw new ActionError(`Malformed URL \`${source}\``, {
                code: CliErrorCode.INVALID_INPUT,
            });
        }

        const sourceUrl = new URL(source);
        const destinationPath = fileSystem.normalizeSeparators(destination);

        try {
            await downloader.download(sourceUrl, destinationPath);
        } catch (error) {
            throw ActionError.fromCause(error);
        }

        if (options.output !== undefined) {
            context.set(options.output.destination, destinationPath);
        }
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'download-source': DownloadSourceOptions;
    }
}
