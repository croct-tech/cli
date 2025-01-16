import tar from 'tar-stream';
import createGunzip from 'gunzip-maybe';
import {Readable} from 'stream';
import {Transport, TransportError, TransportOptions} from '@/application/template/transport/transport';
import {HttpTransport, SuccessResponse} from '@/application/template/transport/httpTransport';
import {FileSystemIterator} from '@/application/fs/fileSystem';

type ParsedUrl = {
    username: string,
    repository: string,
    ref: string|null,
    path: string|null,
};

type GithubFile = ParsedUrl & {
    url: URL,
};

export class GithubTransport<O extends TransportOptions> implements Transport<FileSystemIterator, O> {
    private static readonly PROTOCOL = 'github:';

    private static readonly API_HOST = 'api.github.com';

    private static readonly RAW_HOST = 'raw.github.com';

    private static readonly MAIN_HOST = 'github.com';

    private readonly transport: HttpTransport;

    public constructor(transport: HttpTransport) {
        this.transport = transport;
    }

    public supports(url: URL): boolean {
        const file = this.resolveFile(url);

        return file !== null && this.transport.supports(file.url);
    }

    public async fetch(url: URL, options?: O): Promise<FileSystemIterator> {
        const file = this.resolveFile(url);

        if (file === null) {
            throw new TransportError('Unsupported GitHub URL');
        }

        const response = await this.transport.fetch(file.url, options);

        if (file.url.hostname === GithubTransport.RAW_HOST) {
            return this.extractFile(response, file);
        }

        return this.extractTarball(response, file);
    }

    private async* extractTarball(response: SuccessResponse, file: GithubFile): FileSystemIterator {
        const extract = tar.extract();

        Readable.fromWeb(response.body!)
            .pipe(createGunzip())
            .pipe(extract);

        const depth = file.path === null ? 1 : file.path.split('/').length;

        for await (const entry of extract) {
            const {header} = entry;

            const name = header.name
                .split('/')
                .slice(depth)
                .join('/');

            const linkName = header.linkname
                ?.split('/')
                .slice(depth)
                .join('/') ?? '';

            switch (header.type) {
                case 'file':
                    yield {
                        type: 'file',
                        name: name,
                        content: entry,
                    };

                    break;

                case 'directory':
                    yield {
                        type: 'directory',
                        name: name,
                    };

                    break;

                case 'link':
                    yield {
                        type: 'link',
                        name: name,
                        target: linkName,
                    };

                    break;

                case 'symlink':
                    yield {
                        type: 'symlink',
                        name: name,
                        target: linkName,
                    };

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
                    ? `https://${GithubTransport.RAW_HOST}/${username}/${repository}/${ref}/${path}`
                    : `https://${GithubTransport.API_HOST}/repos/${username}/${repository}/tarball/${ref}`,
            ),
        };
    }

    private parseUrl(url: URL): ParsedUrl|null {
        if (!GithubTransport.isUrlSupported(url)) {
            return null;
        }

        let username: string|null;
        let repository: string|null;
        let ref: string|null = null;
        let segments: string[];

        switch (true) {
            case url.hostname === GithubTransport.MAIN_HOST:
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
            return url.hostname === GithubTransport.MAIN_HOST;
        }

        return url.protocol === GithubTransport.PROTOCOL;
    }
}
