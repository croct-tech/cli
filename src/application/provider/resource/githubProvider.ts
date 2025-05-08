import {Readable} from 'stream';
import {CacheProvider, NoopCache} from '@croct/cache';
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

type DownloadedFile = {
    url: URL,
    response: SuccessResponse,
};

type FileTree = {
    path: string,
    type: 'tree' | 'blob',
};

export type Configuration = {
    provider: HttpProvider,
    cache?: CacheProvider<string, FileTree[]>,
};

export class GithubProvider implements ResourceProvider<FileSystemIterator> {
    private static MAX_DOWNLOAD_FILES = 50;

    private static readonly PROTOCOL = 'github:';

    private static readonly API_HOST = 'api.github.com';

    private static readonly RAW_HOST = 'raw.github.com';

    private static readonly MAIN_HOST = 'github.com';

    private readonly provider: HttpProvider;

    private readonly cache: CacheProvider<string, FileTree[]>;

    public constructor({cache, provider}: Configuration) {
        this.provider = provider;
        this.cache = cache ?? new NoopCache();
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
            async (fileUrl): Promise<DownloadedFile> => ({
                url: fileUrl,
                response: (await this.provider.get(fileUrl)).value,
            }),
        ));

        return {
            url: info.canonicalUrl,
            value: this.yieldFiles(downloads, info.path ?? ''),
        };
    }

    private async* yieldFiles(downloads: DownloadedFile[], path: string): FileSystemIterator {
        const folders = new Set<string>();

        for (const {url, response} of downloads) {
            const segments = url.pathname.split('/');
            const subPath = segments.slice(4);

            const pathname = subPath.join('/') === path && downloads.length === 1
                ? segments.slice(-1)
                : subPath.slice(path.split('/').length);

            if (pathname.length > 1) {
                // Yield directories
                const folderPath = pathname.slice(0, -1);

                for (let index = 0; index < folderPath.length; index++) {
                    const levelPath = folderPath.slice(0, index + 1).join('/');

                    if (!folders.has(levelPath)) {
                        folders.add(levelPath);

                        yield {
                            type: 'directory',
                            name: levelPath,
                        };
                    }
                }
            }

            yield {
                type: 'file',
                name: pathname.join('/'),
                content: Readable.fromWeb(response.body),
            };
        }
    }

    private async resolveFiles(info: ParsedUrl): Promise<URL[]> {
        const {username, repository, path} = info;

        const getFileUrl = (filePath: string): URL => {
            const file = new URL(`https://${GithubProvider.RAW_HOST}`);

            file.pathname = `/${username}/${repository}/${info.ref ?? 'HEAD'}/${filePath}`;

            return file;
        };

        const tree = await this.loadGitTree(info);

        const files: URL[] = [];

        if (path === null) {
            files.push(...tree.map(match => getFileUrl(match.path)));
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
                    ...tree.filter(file => file.path.startsWith(path) && file.type === 'blob').map(
                        match => getFileUrl(match.path),
                    ),
                );
            } else {
                files.push(getFileUrl(path));
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

        const pathname = ((url.protocol === GithubProvider.PROTOCOL ? url.hostname : '') + url.pathname)
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

    private loadGitTree({username, repository, ref}: ParsedUrl): Promise<FileTree[]> {
        const url = new URL(`https://${GithubProvider.API_HOST}`);

        url.pathname = `repos/${username}/${repository}/git/trees/${ref ?? 'HEAD'}`;

        url.searchParams.set('recursive', 'true');

        return this.cache.get(
            url.toString(),
            () => this.provider
                .get(url)
                .then(result => result.value.json() as Promise<{tree: FileTree[]}>)
                .then(({tree}) => tree),
        );
    }

    private static isUrlSupported(url: URL): boolean {
        if (url.protocol === 'https:') {
            return url.hostname === GithubProvider.MAIN_HOST;
        }

        return url.protocol === GithubProvider.PROTOCOL;
    }
}
