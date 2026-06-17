import type {Installation, InstallationPlan} from '@/application/project/sdk/sdk';
import type {Configuration as PhpSdkConfiguration} from '@/application/project/sdk/phpSdk';
import {PhpSdk} from '@/application/project/sdk/phpSdk';
import type {ProjectConfiguration, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import type {ExampleFile} from '@/application/project/code/generation/example';
import {CodeLanguage} from '@/application/project/code/generation/example';
import {BladeExampleGenerator} from '@/application/project/code/generation/slot/bladeExampleGenerator';
import type {Codemod} from '@/application/project/code/transformation/codemod';
import type {RouteOptions} from '@/application/project/code/transformation/php/laravelRouteCodemod';
import {formatSlug} from '@/application/project/code/generation/utils';
import type {Slot} from '@/application/model/slot';
import {UrlExample} from '@/application/project/example/example';
import type {Example} from '@/application/project/example/example';

export type Configuration = PhpSdkConfiguration & {
    routeCodemod: Codemod<string, RouteOptions>,
};

export class PlugLaravelSdk extends PhpSdk {
    private static readonly VIEWS_DIRECTORY = 'resources/views';

    private readonly routeCodemod: Codemod<string, RouteOptions>;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.routeCodemod = configuration.routeCodemod;
    }

    protected getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        return Promise.resolve({
            dependencies: ['croct/plug-laravel'],
            tasks: [],
            configuration: installation.configuration,
        });
    }

    public getPaths(configuration: ProjectConfiguration): Promise<ProjectPaths> {
        return Promise.resolve({
            ...configuration.paths,
            source: configuration.paths?.source ?? 'app',
            utilities: configuration.paths?.utilities ?? 'app/Support',
            components: configuration.paths?.components ?? 'app/View/Components',
            examples: configuration.paths?.examples ?? `${PlugLaravelSdk.VIEWS_DIRECTORY}/croct`,
        });
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const paths = await this.getPaths(installation.configuration);

        const generator = new BladeExampleGenerator({
            contentVariable: 'content',
            filePath: this.fileSystem.joinPaths(paths.examples, '%slug%.blade.php'),
        });

        const {files} = generator.generate({
            id: slot.slug,
            version: slot.version.major,
            definition: slot.resolvedDefinition,
        });

        const route = await this.generateRouteFile(slot.slug, this.resolveViewName(paths.examples, slot.slug));

        if (route !== null) {
            return [...files, route];
        }

        return files;
    }

    protected createExample(slot: Slot): Promise<Example> {
        return Promise.resolve(new UrlExample(slot.name, PlugLaravelSdk.resolveExampleUrl(slot.slug)));
    }

    private async generateRouteFile(slug: string, view: string): Promise<ExampleFile | null> {
        const path = this.fileSystem.joinPaths('routes', 'web.php');
        const absolutePath = this.fileSystem.joinPaths(this.projectDirectory.get(), path);
        const current = await this.fileSystem.exists(absolutePath)
            ? await this.fileSystem.readTextFile(absolutePath)
            : '';

        const {modified, result} = await this.routeCodemod.apply(current, {
            slot: slug,
            url: PlugLaravelSdk.resolveExampleUrl(slug),
            view: view,
        });

        if (modified) {
            return {
                path: path,
                code: result,
                language: CodeLanguage.PHP,
            };
        }

        return null;
    }

    private resolveViewName(examplesDirectory: string, slug: string): string {
        const rootPath = this.projectDirectory.get();
        const namespace = this.fileSystem.getRelativePath(
            this.fileSystem.joinPaths(rootPath, PlugLaravelSdk.VIEWS_DIRECTORY),
            this.fileSystem.joinPaths(rootPath, examplesDirectory),
        );

        // Split on either separator: the relative path uses the OS separator (backslashes on
        // Windows), while the Blade view name is always built with dots.
        return [...namespace.split(/[\\/]/), formatSlug(slug)]
            .filter(segment => segment !== '' && segment !== '.')
            .join('.');
    }

    private static resolveExampleUrl(slug: string): string {
        return `/${formatSlug(slug)}`;
    }
}
