import type {Installation, InstallationPlan} from '@/application/project/sdk/sdk';
import type {Configuration as PhpSdkConfiguration} from '@/application/project/sdk/phpSdk';
import {PhpEnvVar, PhpSdk} from '@/application/project/sdk/phpSdk';
import type {YamlMappingOptions} from '@/application/project/code/transformation/yml/yamlMappingCodemod';
import type {ProjectConfiguration, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import type {ExampleFile} from '@/application/project/code/generation/example';
import {CodeLanguage} from '@/application/project/code/generation/example';
import {TwigExampleGenerator} from '@/application/project/code/generation/slot/twigExampleGenerator';
import type {Codemod} from '@/application/project/code/transformation/codemod';
import {formatSlug} from '@/application/project/code/generation/utils';
import {formatName} from '@/application/project/utils/formatName';
import {HelpfulError} from '@/application/error';
import type {Slot} from '@/application/model/slot';
import {UrlExample} from '@/application/project/example/example';
import type {Example} from '@/application/project/example/example';

export type Configuration = PhpSdkConfiguration & {
    /**
     * Registers the Croct bundle in `config/bundles.php`.
     */
    bundleCodemod: Codemod<string>,

    /**
     * Configures the Croct bundle in `config/packages/croct.yaml`.
     */
    configCodemod: Codemod<string, YamlMappingOptions>,
};

export class PlugSymfonySdk extends PhpSdk {
    private static readonly TEMPLATES_DIRECTORY = 'templates';

    private readonly bundleCodemod: Codemod<string>;

    private readonly configCodemod: Codemod<string, YamlMappingOptions>;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.bundleCodemod = configuration.bundleCodemod;
        this.configCodemod = configuration.configCodemod;
    }

    protected getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        return Promise.resolve({
            dependencies: ['croct/plug-symfony', 'symfony/twig-bundle'],
            tasks: [
                {
                    title: 'Register bundle',
                    task: async notifier => {
                        notifier.update('Registering bundle');

                        try {
                            notifier.confirm(
                                await this.registerBundle()
                                    ? 'Bundle registered'
                                    : 'Bundle already registered',
                            );
                        } catch (error) {
                            notifier.alert('Failed to register bundle', HelpfulError.formatMessage(error));
                        }
                    },
                },
                {
                    title: 'Configure bundle',
                    task: async notifier => {
                        notifier.update('Configuring bundle');

                        try {
                            notifier.confirm(
                                await this.configureBundle()
                                    ? 'Bundle configured'
                                    : 'Bundle already configured',
                            );
                        } catch (error) {
                            notifier.alert('Failed to configure bundle', HelpfulError.formatMessage(error));
                        }
                    },
                },
            ],
            configuration: installation.configuration,
        });
    }

    public async getPaths(configuration: ProjectConfiguration): Promise<ProjectPaths> {
        const paths = await super.getPaths(configuration);

        return {
            ...paths,
            examples: configuration.paths?.examples ?? `${PlugSymfonySdk.TEMPLATES_DIRECTORY}/croct`,
        };
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const paths = await this.getPaths(installation.configuration);

        const generator = new TwigExampleGenerator({
            contentVariable: 'content',
            filePath: this.fileSystem.joinPaths(paths.examples, '%slug%.html.twig'),
        });

        const example = generator.generate({
            id: slot.slug,
            version: slot.version.major,
            definition: slot.resolvedDefinition,
        });

        return [
            ...example.files,
            this.generateController(slot.slug, paths),
        ];
    }

    protected createExample(slot: Slot): Promise<Example> {
        return Promise.resolve(new UrlExample(slot.name, PlugSymfonySdk.resolveExampleUrl(slot.slug)));
    }

    private generateController(slug: string, paths: ProjectPaths): ExampleFile {
        const name = formatName(slug).replace(/^./, character => character.toUpperCase());
        const route = `croct_${formatSlug(slug).replace(/-/g, '_')}`;
        const template = this.resolveTemplateReference(paths.examples, slug);

        const code = [
            '<?php',
            '',
            'declare(strict_types=1);',
            '',
            'namespace App\\Controller;',
            '',
            'use Croct\\Plug\\Plug;',
            'use Symfony\\Bundle\\FrameworkBundle\\Controller\\AbstractController;',
            'use Symfony\\Component\\HttpFoundation\\Response;',
            'use Symfony\\Component\\Routing\\Attribute\\Route;',
            '',
            `final class Croct${name}Controller extends AbstractController`,
            '{',
            `    #[Route('${PlugSymfonySdk.resolveExampleUrl(slug)}', name: '${route}')]`,
            '    public function __invoke(Plug $croct): Response',
            '    {',
            `        return $this->render('${template}', [`,
            `            'content' => $croct->fetchContent('${slug}')->getContent(),`,
            '        ]);',
            '    }',
            '}',
            '',
        ].join('\n');

        return {
            path: this.fileSystem.joinPaths(paths.source, 'Controller', `Croct${name}Controller.php`),
            language: CodeLanguage.PHP,
            code: code,
        };
    }

    private resolveTemplateReference(examplesDirectory: string, slug: string): string {
        const rootPath = this.projectDirectory.get();
        const namespace = this.fileSystem.getRelativePath(
            this.fileSystem.joinPaths(rootPath, PlugSymfonySdk.TEMPLATES_DIRECTORY),
            this.fileSystem.joinPaths(rootPath, examplesDirectory),
        );

        // Split on either separator: the relative path uses the OS separator (backslashes on
        // Windows), while the Twig reference is always built with forward slashes.
        return [...namespace.split(/[\\/]/), `${formatSlug(slug)}.html.twig`]
            .filter(segment => segment !== '' && segment !== '.')
            .join('/');
    }

    private async registerBundle(): Promise<boolean> {
        const path = this.fileSystem.joinPaths(this.projectDirectory.get(), 'config', 'bundles.php');

        return (await this.bundleCodemod.apply(path)).modified;
    }

    private async configureBundle(): Promise<boolean> {
        const path = this.fileSystem.joinPaths(
            this.projectDirectory.get(),
            'config',
            'packages',
            'croct.yaml',
        );

        const result = await this.configCodemod.apply(path, {
            key: 'croct',
            entries: {
                app_id: `'%env(${PhpEnvVar.APP_ID})%'`,
                api_key: `'%env(${PhpEnvVar.API_KEY})%'`,
            },
        });

        return result.modified;
    }

    private static resolveExampleUrl(slug: string): string {
        return `/${formatSlug(slug)}`;
    }
}
