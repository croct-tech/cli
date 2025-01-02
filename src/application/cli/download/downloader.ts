import {CliError, CliHelp} from '@/application/cli/error';

export interface Downloader {
    supports(url: URL): boolean;

    download(url: URL, path: string): Promise<void>;
}

export class DownloadError extends CliError {
    public constructor(message: string, help?: CliHelp) {
        super(message, help);

        Object.setPrototypeOf(this, DownloadError.prototype);
    }
}
