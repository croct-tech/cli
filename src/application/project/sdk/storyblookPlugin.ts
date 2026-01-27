import {extname} from 'path';
import {InstallationPlan, JavaScriptSdkPlugin, JavaScriptPluginContext} from '@/application/project/sdk/javasScriptSdk';
import {Task} from '@/application/cli/io/output';
import {HelpfulError} from '@/application/error';
import {Codemod} from '@/application/project/code/transformation/codemod';
import {Installation} from '@/application/project/sdk/sdk';

export class StoryblookPlugin implements JavaScriptSdkPlugin {
    private readonly codemod: Codemod<string>;

    public constructor(codemod: Codemod<string>) {
        this.codemod = codemod;
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
            title: 'Configuring Storyblok integration',
            task: async notifier => {
                notifier.update('Configuring middleware');

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
        const initializationFile = await this.findStoryblokInitializationFile(scope);

        if (initializationFile === null) {
            throw new HelpfulError('Could not find any file containing Storyblok initialization.');
        }

        const result = await this.codemod.apply(initializationFile);

        if (!result.modified) {
            throw new HelpfulError('Unable to automatically configure Storyblok integration.');
        }
    }

    private async findStoryblokInitializationFile(scope: JavaScriptPluginContext): Promise<string | null> {
        const {fileSystem, projectDirectory} = scope;

        const directory = projectDirectory.get();
        const iterator = fileSystem.list(directory, (path, depth) => {
            if (depth > 20) {
                return false;
            }

            const extension = extname(path).toLowerCase();

            return extension === '.js' || extension === '.ts' || extension === '.jsx' || extension === '.tsx';
        });

        for await (const entry of iterator) {
            if (entry.type !== 'file') {
                continue;
            }

            const path = fileSystem.joinPaths(directory, entry.name);
            const content = await fileSystem.readTextFile(path);

            if (content.includes('storyblokInit')) {
                return path;
            }
        }

        return null;
    }
}
