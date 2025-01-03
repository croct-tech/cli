import {GithubDownloader} from '@/application/cli/download/githubDownloader';
import {LocalFilesystem} from '@/application/fileSystem/localFilesystem';

(async () => {
    const downloader = new GithubDownloader(new LocalFilesystem({
        currentDirectory: process.cwd(),
        defaultEncoding: 'utf-8',
    }));

    await downloader.download(new URL('github:/marcospassos/croct-examples/magic-ui/ui/marquee/next-js/tsx'), 'tmp');
})();
