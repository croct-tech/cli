import type {Installation, InstallationPlan} from '@/application/project/sdk/sdk';
import {PhpSdk} from '@/application/project/sdk/phpSdk';
import type {ExampleFile} from '@/application/project/code/generation/example';
import {PlugPhpExampleGenerator} from '@/application/project/code/generation/slot/plugPhpExampleGenerator';
import type {Slot} from '@/application/model/slot';
import {formatSlug} from '@/application/project/code/generation/utils';
import {UrlExample} from '@/application/project/example/example';
import type {Example} from '@/application/project/example/example';

/**
 * SDK for framework-agnostic PHP projects.
 */
export class PlugPhpSdk extends PhpSdk {
    protected getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        return Promise.resolve({
            dependencies: [
                'croct/plug-php',
                'psr/http-client-implementation',
                'psr/http-factory-implementation',
                'psr/http-message-implementation',
            ],
            tasks: [],
            configuration: installation.configuration,
        });
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const paths = await this.getPaths(installation.configuration);

        const generator = new PlugPhpExampleGenerator({
            contentVariable: 'content',
            filePath: this.fileSystem.joinPaths(paths.examples, '%slug%.php'),
            autoloadPath: this.resolveAutoloadPath(paths.examples),
        });

        const example = generator.generate({
            id: slot.slug,
            version: slot.version.major,
            definition: slot.resolvedDefinition,
        });

        return example.files;
    }

    protected async createExample(slot: Slot, installation: Installation): Promise<Example> {
        const {examples} = await this.getPaths(installation.configuration);

        return new UrlExample(slot.name, PlugPhpSdk.resolveExampleUrl(examples, slot.slug));
    }

    private resolveAutoloadPath(examplesDirectory: string): string {
        const projectDirectory = this.projectDirectory.get();
        const absoluteExamples = this.fileSystem.joinPaths(projectDirectory, examplesDirectory);
        const relativeRoot = this.fileSystem.getRelativePath(absoluteExamples, projectDirectory);

        // Use forward slashes: the path is embedded in generated PHP, which accepts `/` on every
        // platform, and the generator strips the `vendor/autoload.php` suffix with a `/` matcher.
        return this.fileSystem
            .joinPaths(relativeRoot, 'vendor', 'autoload.php')
            .replace(/\\/g, '/');
    }

    private static resolveExampleUrl(examplesDirectory: string, slug: string): string {
        return `/${examplesDirectory}/${formatSlug(slug)}.php`;
    }
}
