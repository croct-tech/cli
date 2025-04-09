import {homedir} from 'os';
import {FirefoxRegistry} from './src/application/system/protocol/firefoxRegistry';
import {LocalFilesystem} from './src/application/fs/localFilesystem';
import {VirtualizedWorkingDirectory} from './src/application/fs/workingDirectory/virtualizedWorkingDirectory';

(async (): Promise<void> => {
    const registry = FirefoxRegistry.macOs({
        fileSystem: new LocalFilesystem({
            workingDirectory: new VirtualizedWorkingDirectory(process.cwd()),
            defaultEncoding: 'utf-8',
        }),
        appPath: '/Users/marcospassos/Library/Application Support/com.croct/apps/croct.app',
        homeDirectory: homedir(),
    });

    await registry.unregister('croct');
})();
