import {extname} from 'path';
import type {
    InstallationPlan,
    JavaScriptSdkPlugin,
    JavaScriptPluginContext,
} from '@/application/project/sdk/javasScriptSdk';
import type {Task} from '@/application/cli/io/output';
import {HelpfulError} from '@/application/error';
import type {Codemod} from '@/application/project/code/transformation/codemod';
import type {Installation} from '@/application/project/sdk/sdk';
import type {ScanFilter} from '@/application/fs/fileSystem';

export type Configuration = {
    storyblokPackage: string,
    marker: string,
    scanFilter: ScanFilter,
    codemod: Codemod<string>,
};

export class WrapperStoryblokPlugin implements JavaScriptSdkPlugin {
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
                        await this.configureStoryblok(context);

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

    private async configureStoryblok(scope: JavaScriptPluginContext): Promise<void> {
        const candidateFiles = await this.findCandidateFiles(scope);

        if (candidateFiles.length === 0) {
            throw new HelpfulError('Could not find any file containing Storyblok initialization.');
        }

        const results = candidateFiles.map(
            file => this.configuration
                .codemod
                .apply(file)
                .then(result => result.modified),
        );

        if (!(await Promise.all(results)).some(modified => modified)) {
            throw new HelpfulError('Could not find any Storyblok initialization to configure.');
        }
    }

    private async findCandidateFiles(scope: JavaScriptPluginContext): Promise<string[]> {
        const {fileSystem, projectDirectory} = scope;

        const directory = projectDirectory.get();
        const iterator = fileSystem.list(directory, async (path, depth) => {
            if (!await this.configuration.scanFilter(path, depth) || depth > 20) {
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

            if (content.includes(this.configuration.marker)) {
                files.push(path);
            }
        }

        return files;
    }
}
