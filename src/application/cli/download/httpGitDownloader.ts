import {Downloader, DownloadError} from '@/application/cli/download/downloader';
import {FileSystem, TarExtractionOptions} from '@/application/fileSystem/fileSystem';
import {CliErrorCode} from '@/application/cli/error';

export type GitSource = {
    tarballUrl: URL,
    directUrl?: URL,
    subdirectory?: string,
};

export abstract class HttpGitDownloader implements Downloader {
    protected readonly fileSystem: FileSystem;

    public constructor(fileSystem: FileSystem) {
        this.fileSystem = fileSystem;
    }

    public supports(url: URL): boolean {
        return this.parseSource(url) !== null;
    }

    public download(url: URL, destination: string): Promise<void> {
        const source = this.parseSource(url);

        if (source === null) {
            throw new DownloadError('Unsupported GitHub URL', {
                code: CliErrorCode.INVALID_INPUT,
                details: [
                    `URL: ${url}`,
                ],
                suggestions: [
                    'Make sure the URL includes the username and repository name',
                ],
            });
        }

        if (source.directUrl !== undefined) {
            return this.downloadFile(source.directUrl, destination);
        }

        return this.downloadRepository(source, destination);
    }

    private async downloadRepository(source: GitSource, destination: string): Promise<void> {
        if (
            await this.fileSystem.isDirectory(destination)
            && !await this.fileSystem.isEmptyDirectory(destination)
        ) {
            throw new DownloadError('Directory is not empty', {
                code: CliErrorCode.PRECONDITION,
                details: [
                    `Directory: ${destination}`,
                ],
                suggestions: [
                    'Delete the directory or its contents and try again',
                ],
            });
        }

        const temporaryDirectory = await this.fileSystem.createTemporaryDirectory();
        const localFile = this.fileSystem.joinPaths(temporaryDirectory, 'source.tar');

        await this.fileSystem.writeFile(localFile, await this.fetch(source.tarballUrl));

        const subdirectory = source.subdirectory ?? null;

        const localDirectory = subdirectory === null
            ? destination
            : this.fileSystem.joinPaths(temporaryDirectory, 'source');

        if (!await this.fileSystem.exists(localDirectory)) {
            await this.fileSystem.createDirectory(localDirectory, {recursive: true});
        }

        await this.fileSystem.extractTar(localFile, localDirectory, this.getTarOptions());

        if (subdirectory !== null) {
            const localSubdirectory = this.fileSystem.joinPaths(
                localDirectory,
                this.fileSystem.normalizeSeparators(subdirectory),
            );

            if (!await this.fileSystem.exists(localSubdirectory)) {
                throw new DownloadError('Subdirectory not found in the repository', {
                    code: CliErrorCode.INVALID_INPUT,
                    details: [
                        `Subdirectory: ${subdirectory}`,
                    ],
                    suggestions: [
                        'Check if the path in the URL is correct',
                    ],
                });
            }

            if (!await this.fileSystem.exists(destination)) {
                await this.fileSystem.createDirectory(destination, {recursive: true});
            }

            await this.fileSystem.moveDirectoryContents(localSubdirectory, destination);
        }

        await this.fileSystem
            .delete(temporaryDirectory, {recursive: true})
            .catch(() => {});
    }

    private async downloadFile(url: URL, destination: string): Promise<void> {
        const filePath = this.fileSystem.joinPaths(
            destination,
            url.pathname
                .split('/')
                .pop() ?? '',
        );

        if (await this.fileSystem.exists(filePath)) {
            throw new DownloadError('File already exists', {
                code: CliErrorCode.PRECONDITION,
                details: [
                    `File: ${filePath}`,
                ],
                suggestions: [
                    'Delete the file and try again',
                ],
            });
        }

        const parentDirectory = this.fileSystem.getDirectoryName(filePath);

        if (!await this.fileSystem.exists(parentDirectory)) {
            await this.fileSystem.createDirectory(parentDirectory, {recursive: true});
        }

        await this.fileSystem.writeFile(filePath, await this.fetch(url));
    }

    private async fetch(url: URL): Promise<Blob> {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new DownloadError('Repository not found', {
                    code: CliErrorCode.OTHER,
                    details: [
                        `URL: ${url}`,
                    ],
                    suggestions: [
                        'Check if the repository exists and the URL is correct',
                        'Make sure the repository is public',
                    ],
                });
            }

            throw new DownloadError('Failed to download the file', {
                code: CliErrorCode.OTHER,
                details: [
                    `Response status: ${response.status}`,
                ],
                suggestions: [
                    'Check your internet connection',
                ],
            });
        }

        return response.blob();
    }

    protected getTarOptions(): TarExtractionOptions {
        return {};
    }

    protected abstract parseSource(url: URL): GitSource|null;
}
