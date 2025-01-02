import {GitSource, HttpGitDownloader} from '@/application/cli/download/httpGitDownloader';
import {TarExtractionOptions} from '@/application/fileSystem/fileSystem';

export class GithubDownloader extends HttpGitDownloader {
    protected parseSource(url: URL): GitSource|null {
        let username: string|null;
        let repository: string|null;
        let ref: string|null = null;
        let segments: string[];

        if (url.protocol === 'github:') {
            [username = null, repository = null, ...segments] = url.pathname
                .split('/')
                .slice(1);
        } else {
            if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
                return null;
            }

            [username, repository, ref = null, ...segments] = url.pathname
                .split('/')
                .slice(1);
        }

        if (username === null || repository === null) {
            return null;
        }

        ref = ref ?? 'HEAD';

        const path = segments !== undefined && segments.length > 0
            ? segments.join('/')
            : undefined;

        return {
            tarballUrl: new URL(`https://api.github.com/repos/${username}/${repository}/tarball/${ref}`),
            directUrl: path !== undefined && /\..+$/.test(path)
                ? new URL(`https://raw.github.com/${username}/${repository}/${ref}/${path}`)
                : undefined,
            subdirectory: path,
        };
    }

    protected getTarOptions(): TarExtractionOptions {
        return {
            stripComponents: 1,
        };
    }
}
