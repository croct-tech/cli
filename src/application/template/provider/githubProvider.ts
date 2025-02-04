import tar from 'tar-stream';
import createGunzip from 'gunzip-maybe';
import {Readable} from 'stream';
import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resourceProvider';
import {HttpProvider, SuccessResponse} from '@/application/template/provider/httpProvider';
import {FileSystemIterator} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

type ParsedUrl = {
    username: string,
    repository: string,
    ref: string|null,
    path: string|null,
};

type GithubFile = ParsedUrl & {
    url: URL,
};

export class GithubProvider implements ResourceProvider<FileSystemIterator> {
    private static readonly PROTOCOL = 'github:';

    private static readonly API_HOST = 'api.github.com';

    private static readonly RAW_HOST = 'raw.github.com';

    private static readonly MAIN_HOST = 'github.com';

    private readonly provider: HttpProvider;

    public constructor(provider: HttpProvider) {
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        const file = this.resolveFile(url);

        return file !== null && this.provider.supports(file.url);
    }

    public async get(url: URL): Promise<Resource<FileSystemIterator>> {
        const file = this.resolveFile(url);

        if (file === null) {
            throw new ResourceProviderError('Unsupported GitHub URL.', {
                reason: ErrorReason.NOT_SUPPORTED,
                url: url,
            });
        }

        const {value: response} = await this.provider.get(file.url);

        return {
            url: url,
            value: file.url.hostname === GithubProvider.RAW_HOST
                ? this.extractFile(response, file)
                : this.extractTarball(response, file),
        };
    }

    private async* extractTarball(response: SuccessResponse, file: GithubFile): FileSystemIterator {
        const extract = tar.extract();

        Readable.fromWeb(response.body!)
            .pipe(createGunzip())
            .pipe(extract);

        const targetPath = GithubProvider.removeTrailSlash(file.path ?? '');

        for await (const entry of extract) {
            const {header} = entry;

            entry.resume();

            const name = GithubProvider.removeTrailSlash(
                header.name
                    .split('/')
                    .slice(1)
                    .join('/'),
            );

            if (
                name === ''
                || !name.startsWith(targetPath)
                || (entry.header.type === 'directory' && name === targetPath)
            ) {
                continue;
            }

            let relativeName = name;

            if (targetPath.length > 0 && name.length > targetPath.length) {
                relativeName = name.slice(targetPath.length + 1);
            }

            switch (header.type) {
                case 'file':
                    yield {
                        type: 'file',
                        name: relativeName,
                        content: entry,
                    };

                    break;

                case 'directory':
                    yield {
                        type: 'directory',
                        name: relativeName,
                    };

                    break;

                case 'link':
                    yield {
                        type: 'link',
                        name: relativeName,
                        target: header.linkname!,
                    };

                    break;

                case 'symlink':
                    yield {
                        type: 'symlink',
                        name: relativeName,
                        target: header.linkname!,
                    };

                    break;
            }

            if (relativeName === targetPath) {
                break;
            }
        }
    }

    private async* extractFile(response: SuccessResponse, resolvedUrl: GithubFile): FileSystemIterator {
        yield {
            type: 'file',
            name: resolvedUrl.url
                .pathname
                .split('/')
                .pop() ?? resolvedUrl.url.pathname,
            content: Readable.fromWeb(response.body),
        };
    }

    private resolveFile(url: URL): GithubFile|null {
        const info = this.parseUrl(url);

        if (info === null) {
            return null;
        }

        const {username, repository, path} = info;
        const ref = info.ref ?? 'HEAD';

        return {
            ...info,
            url: new URL(
                path !== null && /\..+$/.test(path)
                    ? `https://${GithubProvider.RAW_HOST}/${username}/${repository}/${ref}/${path}`
                    : `https://${GithubProvider.API_HOST}/repos/${username}/${repository}/tarball/${ref}`,
            ),
        };
    }

    private parseUrl(url: URL): ParsedUrl|null {
        if (!GithubProvider.isUrlSupported(url)) {
            return null;
        }

        let username: string|null;
        let repository: string|null;
        let ref: string|null = null;
        let segments: string[];

        switch (true) {
            case url.hostname === GithubProvider.MAIN_HOST:
                [username = null, repository = null, /* tree/blob */, ref = null, ...segments] = url.pathname
                    .split('/')
                    .slice(1);

                break;

            default:
                [username = null, repository = null, ...segments] = url.pathname
                    .split('/')
                    .slice(1);

                break;
        }

        if (username === null || repository === null) {
            return null;
        }

        return {
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

    private static removeTrailSlash(path: string): string {
        return path.replace(/\/$/, '');
    }
}
