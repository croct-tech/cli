import {InstallationPlan, JavaScriptSdkPlugin} from '@/application/project/sdk/javasScriptSdk';
import {Installation} from '@/application/project/sdk/sdk';
import {PackageManager} from '@/application/project/packageManager/packageManager';
import {Task} from '@/application/cli/io/output';
import {HelpfulError} from '@/application/error';

export class StoryblookPlugin implements JavaScriptSdkPlugin {
    private packageManager: PackageManager;

    public async getInstallationPlan(_: Installation): Promise<Partial<InstallationPlan>> {
        if (!await this.packageManager.hasDependency('@storyblok/js')) {
            return {};
        }

        const tasks: Task[] = [];

        tasks.push({
            title: 'Configuring Storyblok integration',
            task: async notifier => {
                notifier.update('Configuring middleware');

                try {
                    await this.updateCode(this.codemod.middleware, installation.project.middleware.file);

                    notifier.confirm('Storyblok configured');
                } catch (error) {
                    notifier.alert('Failed to configure Storyblok', HelpfulError.formatMessage(error));
                }
            },
        });

        return {
            dependencies: ['@croct/plug-storyblok'],
        };
    }
}
