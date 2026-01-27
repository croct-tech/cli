import {extname} from 'path';
import {InstallationPlan, JavaScriptSdkPlugin, JavaScriptPluginContext} from '@/application/project/sdk/javasScriptSdk';
import {Task} from '@/application/cli/io/output';
import {HelpfulError} from '@/application/error';
import {Codemod} from '@/application/project/code/transformation/codemod';
import {Installation} from '@/application/project/sdk/sdk';
import {ScanFilter} from '@/application/fs/fileSystem';

export type Configuration = {
    scanFilter: ScanFilter,
    codemod: Codemod<string>,
};

export class StoryblookPlugin implements JavaScriptSdkPlugin {
    private readonly codemod: Codemod<string>;

    private readonly scanFilter: ScanFilter;

    public constructor(configuration: Configuration) {
        this.codemod = configuration.codemod;
        this.scanFilter = configuration.scanFilter;
    }

    public async getInstallationPlan(
        _: Installation,
        context: JavaScriptPluginContext,
    ): Promise<Partial<InstallationPlan>> {
        if (!await context.packageManager.hasDependency('@storyblok/js')) {
            return {};
        }

        const tasks: Task[] = [];

        tasks.push({
            title: 'Configure Storyblok integration',
            task: async notifier => {
                notifier.update('Configuring Storyblok integration');

                try {
                    await this.configureStoryblok(context);

                    notifier.confirm('Storyblok configured');
                } catch (error) {
                    notifier.alert('Failed to configure Storyblok', HelpfulError.formatMessage(error));
                }
            },
        });

        return {
            tasks: tasks,
            dependencies: ['@croct/plug-storyblok'],
        };
    }

    private async configureStoryblok(scope: JavaScriptPluginContext): Promise<void> {
        const initializationFiles = await this.findStoryblokInitializationFiles(scope);

        if (initializationFiles.length === 0) {
            throw new HelpfulError('Could not find any file containing Storyblok initialization.');
        }

        const results = initializationFiles.map(
            file => this.codemod
                .apply(file)
                .then(result => result.modified),
        );

        if (!(await Promise.all(results)).some(modified => modified)) {
            throw new HelpfulError('Could not find any Storyblok initialization to configure.');
        }
    }

    private async findStoryblokInitializationFiles(scope: JavaScriptPluginContext): Promise<string[]> {
        const {fileSystem, projectDirectory} = scope;

        const directory = projectDirectory.get();
        const iterator = fileSystem.list(directory, async (path, depth) => {
            if (!await this.scanFilter(path, depth) || depth > 20) {
                return false;
            }

            const extension = extname(path).toLowerCase();

            // Allow directories (no extension) and JS/TS files
            return extension === ''
                || extension === '.js'
                || extension === '.ts'
                || extension === '.jsx'
                || extension === '.tsx';
        });

        const files: string[] = [];

        for await (const entry of iterator) {
            if (entry.type !== 'file') {
                continue;
            }

            const path = fileSystem.joinPaths(directory, entry.name);
            const content = await fileSystem.readTextFile(path);

            if (content.includes('storyblokInit')) {
                files.push(path);
            }
        }

        return files;
    }
}
