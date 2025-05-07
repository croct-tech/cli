import {Readable} from 'stream';
import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {HttpProvider, SuccessResponse} from '@/application/provider/resource/httpProvider';
import {FileSystemIterator} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

type ParsedUrl = {
    username: string,
    repository: string,
    ref: string|null,
    path: string|null,
    canonicalUrl: URL,
};

type GithubFile = ParsedUrl & {
    url: URL,
};

type DownloadedFile = {
    url: URL,
    response: SuccessResponse,
};

type FileTree = {
    path: string,
    type: 'tree' | 'blob',
};

export class GithubProvider implements ResourceProvider<FileSystemIterator> {
    private static MAX_DOWNLOAD_FILES = 50;

    private static readonly PROTOCOL = 'github:';

    private static readonly API_HOST = 'api.github.com';

    private static readonly RAW_HOST = 'raw.github.com';

    private static readonly MAIN_HOST = 'github.com';

    private readonly provider: HttpProvider;

    public constructor(provider: HttpProvider) {
        this.provider = provider;
    }

    public async get(url: URL): Promise<Resource<FileSystemIterator>> {
        const info = this.parseUrl(url);

        if (info === null) {
            throw new ResourceProviderError('Unsupported GitHub URL.', {
                reason: ErrorReason.NOT_SUPPORTED,
                url: url,
            });
        }

        const resolvedFiles = await this.resolveFiles(info);
        const downloads = await Promise.all(resolvedFiles.map(
            async (file): Promise<DownloadedFile> => ({
                url: file.url,
                response: (await this.provider.get(file.url)).value,
            }),
        ));

        return {
            url: info.canonicalUrl,
            value: this.yieldFiles(downloads),
        };
    }

    private async* yieldFiles(downloads: DownloadedFile[]): FileSystemIterator {
        for (const {url, response} of downloads) {
            yield {
                type: 'file',
                name: url
                    .pathname
                    .split('/')
                    .pop()!,
                content: Readable.fromWeb(response.body),
            };
        }
    }

    private async resolveFiles(info: ParsedUrl): Promise<GithubFile[]> {
        const {username, repository, path} = info;
        const ref = info.ref ?? 'HEAD';

        const {tree} = await this.provider
            .get(new URL(`https://${GithubProvider.API_HOST}/repos/${username}/${repository}/git/trees/${ref}`))
            .then(result => result.value.json() as Promise<{tree: FileTree[]}>);

        const getFileUrl = (filePath: string): URL => (
            new URL(`https://${GithubProvider.RAW_HOST}/${username}/${repository}/${ref}/${filePath}`)
        );

        const files: GithubFile[] = [];

        if (path === null) {
            files.push(
                ...tree.map(
                    match => ({
                        ...info,
                        url: getFileUrl(match.path),
                    }),
                ),
            );
        } else {
            const targetTree = tree.find(file => file.path === path);

            if (targetTree === undefined) {
                throw new ResourceProviderError('File not found.', {
                    reason: ErrorReason.NOT_FOUND,
                    url: info.canonicalUrl,
                });
            }

            if (targetTree.type === 'tree') {
                files.push(
                    ...tree.filter(file => file.path.startsWith(path)).map(
                        match => ({
                            ...info,
                            url: getFileUrl(match.path),
                        }),
                    ),
                );
            } else {
                files.push({
                    ...info,
                    url: getFileUrl(path),
                });
            }
        }

        if (files.length > GithubProvider.MAX_DOWNLOAD_FILES) {
            throw new ResourceProviderError(
                `The number of files to download exceeds the limit of ${GithubProvider.MAX_DOWNLOAD_FILES}.`,
                {
                    reason: ErrorReason.PRECONDITION,
                    url: info.canonicalUrl,
                },
            );
        }

        return files;
    }

    private parseUrl(url: URL): ParsedUrl|null {
        if (!GithubProvider.isUrlSupported(url)) {
            return null;
        }

        let username: string|null;
        let repository: string|null;
        let ref: string|null = null;
        let segments: string[];

        const pathname = url.pathname
            .replace(/^\/+/, '')
            .split('/');

        let canonicalUrl: URL|null = null;

        if (url.hostname === GithubProvider.MAIN_HOST) {
            canonicalUrl = url;
            [username = null, repository = null, /* tree/blob */, ref = null, ...segments] = pathname;
        } else {
            [username = null, repository = null, ...segments] = pathname;
        }

        if (username === null || repository === null) {
            return null;
        }

        if (canonicalUrl === null) {
            canonicalUrl = new URL(`https://${GithubProvider.MAIN_HOST}`);
            // GitHub automatically fixes blob/tree is mismatched,
            // and redirects master to the default branch
            canonicalUrl.pathname = `/${username}/${repository}/blob/master/${segments.join('/')}`;
        }

        return {
            canonicalUrl: canonicalUrl,
            username: username,
            repository: repository,
            ref: ref,
            path: segments !== undefined && segments.length > 0
                ? segments.join('/')
                : null,
        };
    }

    private static isUrlSupported(url: URL): boolean {
        if (url.protocol === 'https:') {
            return url.hostname === GithubProvider.MAIN_HOST;
        }

        return url.protocol === GithubProvider.PROTOCOL;
    }
}
