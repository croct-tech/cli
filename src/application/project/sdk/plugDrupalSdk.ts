import type {Installation, InstallationPlan} from '@/application/project/sdk/sdk';
import {SdkError} from '@/application/project/sdk/sdk';
import type {Configuration as PhpSdkConfiguration} from '@/application/project/sdk/phpSdk';
import {PhpSdk} from '@/application/project/sdk/phpSdk';
import type {ProjectConfiguration, ProjectPaths} from '@/application/project/configuration/projectConfiguration';
import type {Output, Task, TaskNotifier} from '@/application/cli/io/output';
import type {Codemod} from '@/application/project/code/transformation/codemod';
import type {ExampleFile} from '@/application/project/code/generation/example';
import {CodeLanguage} from '@/application/project/code/generation/example';
import {TwigExampleGenerator} from '@/application/project/code/generation/slot/twigExampleGenerator';
import {formatSlug} from '@/application/project/code/generation/utils';
import {formatName} from '@/application/project/utils/formatName';
import {UrlExample} from '@/application/project/example/example';
import type {Example} from '@/application/project/example/example';
import {ErrorReason} from '@/application/error';
import type {Slot} from '@/application/model/slot';

export type Configuration = PhpSdkConfiguration & {
    localSettingsFileCodemod: Codemod<string>,
};

export class PlugDrupalSdk extends PhpSdk {
    private static readonly MODULE_NAME = 'croct_example';

    public static readonly LOCAL_SETTINGS_FILE = 'settings.local.php';

    private static readonly SETTINGS = {
        APP_ID: 'croct.app_id',
        API_KEY: 'croct.api_key',
    };

    private readonly localSettingsFileCodemod: Codemod<string>;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.localSettingsFileCodemod = configuration.localSettingsFileCodemod;
    }

    protected getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        const tasks = [
            this.getModuleTask(),
            this.getLocalSettingsTask(),
        ];

        return Promise.resolve({
            dependencies: ['croct/plug-drupal'],
            tasks: tasks,
            configuration: installation.configuration,
        });
    }

    private getModuleTask(): Task {
        return {
            title: 'Enable the Croct module (`drush en croct`)',
            task: async notifier => {
                notifier.update('Enabling the Croct module with `drush en croct`');

                if (await this.enableModule()) {
                    notifier.confirm('Croct module enabled');
                } else {
                    notifier.warn('Could not enable the Croct module', 'Run `drush en croct` to enable it manually.');
                }
            },
        };
    }

    private getLocalSettingsTask(): Task {
        const instruction = 'Add the `settings.local.php` include to `settings.php` so Croct can read the credentials.';

        return {
            title: 'Include settings.local.php in settings.php',
            task: async notifier => {
                notifier.update('Adding the `settings.local.php` include to `settings.php`');

                switch (await this.includeLocalSettings()) {
                    case 'included':
                        return notifier.confirm('Added the `settings.local.php` include to `settings.php`');

                    case 'unchanged':
                        return notifier.confirm('`settings.php` already includes `settings.local.php`');

                    default:
                        return notifier.warn('Could not include the local settings', instruction);
                }
            },
        };
    }

    public async getPaths(configuration: ProjectConfiguration): Promise<ProjectPaths> {
        const modules = await this.resolveModulesDirectory();

        return {
            ...configuration.paths,
            source: configuration.paths?.source ?? modules,
            utilities: configuration.paths?.utilities ?? modules,
            components: configuration.paths?.components ?? modules,
            examples: configuration.paths?.examples ?? this.fileSystem.joinPaths(modules, PlugDrupalSdk.MODULE_NAME),
        };
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const module = (await this.getPaths(installation.configuration)).examples;

        return [
            this.generateModuleInfo(module),
            this.generateInstallHook(module),
            this.generateBlock(slot, module),
        ];
    }

    public async presentExamples(slots: Slot[], installation: Installation): Promise<void> {
        const {input, output} = installation;

        if (input === undefined) {
            PlugDrupalSdk.printExampleSteps(output);

            return;
        }

        const enable = await input.confirm({
            message: 'Enable the Croct example module now? It places the example block(s) in the Content region.',
            default: true,
        });

        if (!enable) {
            PlugDrupalSdk.printExampleSteps(output);

            return;
        }

        const notifier = output.notify('Enabling the Croct example module');

        if (!await this.enableExampleModule()) {
            notifier.stop();
            output.warn('Could not enable the Croct example module.');
            PlugDrupalSdk.printExampleSteps(output);

            return;
        }

        notifier.confirm('Croct example module enabled');

        // Every block renders on the front page, so present it once for the first slot.
        await this.exampleLauncher.launch({
            examples: [await this.createExample(slots[0])],
            input: input,
            output: output,
        });
    }

    protected createExample(slot: Slot): Promise<Example> {
        return Promise.resolve(new UrlExample(slot.name, '/'));
    }

    protected async setUpCredentials(installation: Installation & {notifier: TaskNotifier}): Promise<void> {
        await super.setUpCredentials(installation);

        installation.notifier.update('Rebuilding the Drupal cache to apply the credentials');

        // Drupal compiles settings.php values into the cached container at build time, so the
        // credentials written above only take effect after a rebuild. Without it the module boots
        // with an empty API key and every request throws a ConfigurationException.
        if (!await this.rebuildCache()) {
            installation.notifier.warn(
                'Could not rebuild the Drupal cache',
                'Run `drush cr` to apply the Croct credentials.',
            );
        }
    }

    protected async hasApiKey(): Promise<boolean> {
        const path = await this.resolveLocalSettingsFile();

        if (path === null || !await this.fileSystem.exists(path)) {
            return false;
        }

        return (await this.fileSystem.readTextFile(path)).includes(`$settings['${PlugDrupalSdk.SETTINGS.API_KEY}']`);
    }

    protected async storeApiKey(secret: string): Promise<void> {
        await this.writeSetting(PlugDrupalSdk.SETTINGS.API_KEY, secret);
    }

    protected async storeAppId(publicId: string): Promise<void> {
        await this.writeSetting(PlugDrupalSdk.SETTINGS.APP_ID, publicId);
    }

    private generateModuleInfo(module: string): ExampleFile {
        return {
            path: this.fileSystem.joinPaths(module, `${PlugDrupalSdk.MODULE_NAME}.info.yml`),
            language: CodeLanguage.YAML,
            code: [
                "name: 'Croct Example'",
                'type: module',
                "description: 'Example blocks rendering Croct slots.'",
                'package: Croct',
                'core_version_requirement: ^10 || ^11',
                'dependencies:',
                "  - 'croct:croct'",
                '',
            ].join('\n'),
        };
    }

    private generateInstallHook(module: string): ExampleFile {
        const name = PlugDrupalSdk.MODULE_NAME;

        return {
            path: this.fileSystem.joinPaths(module, `${name}.install`),
            language: CodeLanguage.PHP,
            code: [
                '<?php',
                '',
                'declare(strict_types=1);',
                '',
                'use Drupal\\block\\Entity\\Block;',
                '',
                '/**',
                ' * Implements hook_install().',
                ' *',
                " * Places the example blocks in the default theme's content region.",
                ' */',
                `function ${name}_install(): void`,
                '{',
                "    $theme = \\Drupal::config('system.theme')->get('default');",
                "    $manager = \\Drupal::service('plugin.manager.block');",
                '',
                '    foreach ($manager->getDefinitions() as $id => $definition) {',
                `        if (($definition['provider'] ?? '') !== '${name}') {`,
                '            continue;',
                '        }',
                '',
                "        $blockId = $theme . '_' . $id;",
                '',
                '        if (Block::load($blockId) !== null) {',
                '            continue;',
                '        }',
                '',
                '        Block::create([',
                "            'id' => $blockId,",
                "            'plugin' => $id,",
                "            'region' => 'content',",
                "            'theme' => $theme,",
                "            'weight' => -50,",
                "            'settings' => [",
                "                'id' => $id,",
                "                'label' => (string) $definition['admin_label'],",
                "                'label_display' => '0',",
                `                'provider' => '${name}',`,
                '            ],',
                '        ])->save();',
                '    }',
                '}',
                '',
            ].join('\n'),
        };
    }

    private generateBlock(slot: Slot, module: string): ExampleFile {
        const name = formatName(slot.slug).replace(/^./, character => character.toUpperCase());
        const id = `croct_${formatSlug(slot.slug).replace(/-/g, '_')}`;
        const label = PlugDrupalSdk.formatTitle(slot.slug)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");

        const fragment = new TwigExampleGenerator({
            contentVariable: 'content',
            filePath: '',
            page: false,
        }).generate({
            id: slot.slug,
            version: slot.version.major,
            definition: slot.resolvedDefinition,
        }).files[0].code;

        // Indent the fragment under the heredoc body; PHP strips the closing marker's indentation.
        const template = fragment
            .trimEnd()
            .split('\n')
            .map(line => (line === '' ? '' : `            ${line}`))
            .join('\n');

        const code = [
            '<?php',
            '',
            'declare(strict_types=1);',
            '',
            'namespace Drupal\\croct_example\\Plugin\\Block;',
            '',
            'use Croct\\Plug\\Plug;',
            'use Drupal\\Core\\Block\\Attribute\\Block;',
            'use Drupal\\Core\\Block\\BlockBase;',
            'use Drupal\\Core\\Plugin\\ContainerFactoryPluginInterface;',
            'use Drupal\\Core\\StringTranslation\\TranslatableMarkup;',
            'use Symfony\\Component\\DependencyInjection\\ContainerInterface;',
            '',
            '#[Block(',
            `    id: '${id}',`,
            `    admin_label: new TranslatableMarkup('Croct: ${label}'),`,
            ')]',
            `final class ${name}Block extends BlockBase implements ContainerFactoryPluginInterface`,
            '{',
            '    public function __construct(',
            '        array $configuration,',
            '        string $pluginId,',
            '        mixed $pluginDefinition,',
            '        private readonly Plug $croct,',
            '    ) {',
            '        parent::__construct($configuration, $pluginId, $pluginDefinition);',
            '    }',
            '',
            '    public static function create(',
            '        ContainerInterface $container,',
            '        array $configuration,',
            '        $plugin_id,',
            '        $plugin_definition,',
            '    ): self {',
            '        return new self($configuration, $plugin_id, $plugin_definition, $container->get(Plug::class));',
            '    }',
            '',
            '    /**',
            '     * @return array<string, mixed>',
            '     */',
            '    public function build(): array',
            '    {',
            '        return [',
            "            '#type' => 'inline_template',",
            "            '#template' => <<<'TWIG'",
            template,
            '            TWIG,',
            "            '#context' => [",
            `                'content' => $this->croct->fetchContent('${slot.slug}')->getContent(),`,
            '            ],',
            '            // Personalized per visitor, so vary the render cache by session.',
            "            '#cache' => [",
            "                'contexts' => ['session'],",
            '            ],',
            '        ];',
            '    }',
            '}',
            '',
        ].join('\n');

        return {
            path: this.fileSystem.joinPaths(module, 'src', 'Plugin', 'Block', `${name}Block.php`),
            language: CodeLanguage.PHP,
            code: code,
        };
    }

    private async writeSetting(key: string, value: string): Promise<void> {
        const path = await this.resolveLocalSettingsFile();

        if (path === null) {
            throw new SdkError('Could not locate the Drupal site directory to store the credentials.', {
                reason: ErrorReason.NOT_FOUND,
            });
        }

        const content = await this.fileSystem.exists(path)
            ? await this.fileSystem.readTextFile(path)
            : '<?php\n\n';

        if (content.includes(`$settings['${key}']`)) {
            return;
        }

        const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const line = `$settings['${key}'] = '${escaped}';\n`;

        // Drupal locks the site directory (0555) and any existing settings.local.php (0444) after
        // install; unlock the directory and file for the write, then restore their modes.
        await this.runWritablePaths(
            [this.fileSystem.getDirectoryName(path), path],
            () => this.fileSystem.writeTextFile(
                path,
                `${content}${content.endsWith('\n') ? '' : '\n'}${line}`,
                {overwrite: true},
            ),
        );
    }

    /**
     * Runs a write while the given paths are owner-writable, restoring their original modes after.
     */
    private async runWritablePaths<T>(paths: string[], action: () => Promise<T>): Promise<T> {
        const restore: Array<[string, number]> = [];

        for (const path of paths) {
            if (await this.fileSystem.exists(path)) {
                const mode = await this.fileSystem.getPermissions(path);

                if ((mode & 0o200) === 0) {
                    await this.fileSystem.setPermissions(path, mode | 0o200);
                    restore.push([path, mode]);
                }
            }
        }

        try {
            return await action();
        } finally {
            for (const [path, mode] of restore) {
                await this.fileSystem.setPermissions(path, mode);
            }
        }
    }

    private enableModule(): Promise<boolean> {
        return this.runDrush(['en', 'croct', '--yes']);
    }

    private rebuildCache(): Promise<boolean> {
        return this.runDrush(['cache:rebuild']);
    }

    private async enableExampleModule(): Promise<boolean> {
        if (!await this.runDrush(['en', PlugDrupalSdk.MODULE_NAME, '--yes'])) {
            return false;
        }

        // The install hook places the blocks, but only on first install, so re-run it to also
        // cover the case where the module was already enabled (it is idempotent, keeping any
        // block already placed). Clear the block definition cache before placing: the blocks
        // were generated after the last rebuild, so a stale discovery cache would hide them and
        // only some (or none) would be placed.
        const module = PlugDrupalSdk.MODULE_NAME;
        const place = `\\Drupal::moduleHandler()->loadInclude('${module}', 'install');`
            + ` \\Drupal::service('plugin.manager.block')->clearCachedDefinitions(); ${module}_install();`;

        if (!await this.runDrush(['php:eval', place])) {
            return false;
        }

        // Rebuild so the freshly placed blocks render immediately on the front page.
        return this.rebuildCache();
    }

    private async runDrush(args: string[]): Promise<boolean> {
        try {
            // Resolved the same way as npm packages: the package manager runs the project's
            // own binary (`composer exec drush ...`), so the path is never built by hand.
            const command = await this.packageManager.getPackageCommand('drush', args);

            const execution = await this.commandExecutor.run(command, {
                workingDirectory: this.projectDirectory.get(),
            });

            return await execution.wait() === 0;
        } catch {
            return false;
        }
    }

    private static printExampleSteps(output: Output): void {
        output.inform(
            [
                'To view the example:',
                `1. Enable the module: \`drush en ${PlugDrupalSdk.MODULE_NAME}\` (or via \`/admin/modules\`).`,
                "2. Open your site's front page.",
                '3. If a block is missing, place it at `/admin/structure/block` (search "Croct").',
            ].join('\n'),
        );
    }

    private async includeLocalSettings(): Promise<'included' | 'unchanged' | 'missing'> {
        const path = await this.resolveSettingsFile();

        if (path === null) {
            return 'missing';
        }

        // The injected codemod reads/writes settings.php and style-fixes it by
        // decoration; its `modified` flag tells whether the include was added. Drupal leaves
        // settings.php read-only after install, so apply it under a temporary unlock.
        const {modified} = await this.runWritablePaths([path], () => this.localSettingsFileCodemod.apply(path));

        return modified ? 'included' : 'unchanged';
    }

    private async resolveSettingsFile(): Promise<string | null> {
        const directory = await this.resolveSettingsDirectory();

        return directory === null ? null : this.fileSystem.joinPaths(directory, 'settings.php');
    }

    private async resolveLocalSettingsFile(): Promise<string | null> {
        const directory = await this.resolveSettingsDirectory();

        return directory === null
            ? null
            : this.fileSystem.joinPaths(directory, PlugDrupalSdk.LOCAL_SETTINGS_FILE);
    }

    private async resolveSettingsDirectory(): Promise<string | null> {
        const root = this.projectDirectory.get();
        const candidates = [
            ['web', 'sites', 'default'],
            ['sites', 'default'],
        ];

        for (const segments of candidates) {
            const directory = this.fileSystem.joinPaths(root, ...segments);

            if (await this.fileSystem.exists(this.fileSystem.joinPaths(directory, 'settings.php'))) {
                return directory;
            }
        }

        return null;
    }

    private async resolveModulesDirectory(): Promise<string> {
        const hasDocroot = await this.fileSystem.exists(this.fileSystem.joinPaths(this.projectDirectory.get(), 'web'));

        return hasDocroot ? 'web/modules/custom' : 'modules/custom';
    }

    private static formatTitle(slug: string): string {
        return formatSlug(slug)
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}
