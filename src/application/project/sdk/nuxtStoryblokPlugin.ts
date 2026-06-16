import type {JavaScriptPluginContext, JavaScriptSdkPlugin} from '@/application/project/sdk/javasScriptSdk';
import type {Task} from '@/application/cli/io/output';
import {HelpfulError} from '@/application/error';
import type {Codemod} from '@/application/project/code/transformation/codemod';
import type {Installation, InstallationPlan} from '@/application/project/sdk/sdk';

export type Configuration = {
    storyblokPackage: string,
    pluginFile: string,
    codemod: Codemod<string>,
};

export class NuxtStoryblokPlugin implements JavaScriptSdkPlugin {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public async getInstallationPlan(
        _: Installation,
        context: JavaScriptPluginContext,
    ): Promise<Partial<InstallationPlan>> {
        if (!await context.packageManager.hasDirectDependency(this.configuration.storyblokPackage)) {
            return {};
        }

        const tasks: Task[] = [
            {
                title: 'Configure Storyblok integration',
                task: async notifier => {
                    notifier.update('Configuring Storyblok integration');

                    try {
                        await this.scaffoldPluginFile(context);

                        notifier.confirm('Storyblok configured');
                    } catch (error) {
                        notifier.alert('Failed to configure Storyblok', HelpfulError.formatMessage(error));
                    }
                },
            },
        ];

        return {
            tasks: tasks,
            dependencies: ['@croct/plug-storyblok'],
        };
    }

    private async scaffoldPluginFile(scope: JavaScriptPluginContext): Promise<void> {
        const {fileSystem, projectDirectory} = scope;
        const path = fileSystem.joinPaths(projectDirectory.get(), this.configuration.pluginFile);

        if (!await fileSystem.exists(path)) {
            await fileSystem.createDirectory(fileSystem.getDirectoryName(path), {recursive: true});
            await fileSystem.writeTextFile(path, '', {overwrite: true});
        }

        await this.configuration
            .codemod
            .apply(path);
    }
}
