import {JsonArrayNode, JsonObjectNode, JsonParser} from '@croct/json5-parser/index.js';
import {
    UpdateOptions as BaseContentOptions,
    Installation,
    Sdk,
    SdkError,
    UpdateOptions,
} from '@/application/project/sdk/sdk';
import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {Task, TaskNotifier} from '@/application/cli/io/output';
import {TargetSdk, WorkspaceApi} from '@/application/api/workspace';
import {ExampleFile} from '@/application/project/code/generation/example';
import {CodeFormatter} from '@/application/project/code/formatting/formatter';
import {Version} from '@/application/model/version';
import {FileSystem} from '@/application/fs/fileSystem';
import {Slot} from '@/application/model/slot';
import {LocalizedContentMap} from '@/application/model/experience';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Dependency, PackageManager} from '@/application/project/packageManager/packageManager';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {TsConfigLoader} from '@/application/project/import/tsConfigLoader';
import {multiline} from '@/utils/multiline';
import {formatName} from '@/application/project/utils/formatName';

export type InstallationPlan = {
    tasks: Task[],
    dependencies: string[],
    configuration: ProjectConfiguration,
};

export type Configuration = {
    workspaceApi: WorkspaceApi,
    projectDirectory: WorkingDirectory,
    packageManager: PackageManager,
    formatter: CodeFormatter,
    fileSystem: FileSystem,
    tsConfigLoader: TsConfigLoader,
};

type VersionedContent = {
    version: number,
    content: LocalizedContentMap,
};

type VersionedContentMap = Record<string, VersionedContent[]>;

type ContentOptions = BaseContentOptions & {
    notifier?: TaskNotifier,
};

export abstract class JavaScriptSdk implements Sdk {
    protected static readonly CONTENT_PACKAGE = '@croct/content';

    protected readonly projectDirectory: WorkingDirectory;

    protected readonly packageManager: PackageManager;

    protected readonly workspaceApi: WorkspaceApi;

    protected readonly formatter: CodeFormatter;

    protected readonly fileSystem: FileSystem;

    private readonly importConfigLoader: TsConfigLoader;

    protected constructor(configuration: Configuration) {
        this.projectDirectory = configuration.projectDirectory;
        this.packageManager = configuration.packageManager;
        this.workspaceApi = configuration.workspaceApi;
        this.formatter = configuration.formatter;
        this.fileSystem = configuration.fileSystem;
        this.importConfigLoader = configuration.tsConfigLoader;
    }

    public async generateSlotExample(slot: Slot, installation: Installation): Promise<void> {
        const rootPath = this.projectDirectory.get();
        const files: string[] = [];

        for (const file of await this.generateSlotExampleFiles(slot, installation)) {
            const directory = this.fileSystem.joinPaths(rootPath, this.fileSystem.getDirectoryName(file.path));

            await this.fileSystem
                .createDirectory(directory, {recursive: true})
                .catch(() => null);

            const filePath = this.fileSystem.joinPaths(rootPath, file.path);

            await this.fileSystem.writeTextFile(filePath, file.code, {overwrite: true});

            files.push(filePath);
        }

        await this.formatter.format(files);
    }

    protected abstract generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]>;

    public async setup(installation: Installation): Promise<ProjectConfiguration> {
        const {input, output} = installation;

        const plan = await this.getInstallationPlan(installation);

        const configuration: ProjectConfiguration = {
            ...plan.configuration,
            paths: {
                content: '.',
                components: await this.resolvePath(
                    ['components', 'Components', 'component', 'Component'],
                    plan.configuration.paths.components,
                ),
                examples: await this.resolvePath(
                    ['examples', 'Examples'],
                    plan.configuration.paths.examples,
                ),
            },
        };

        const resolvedInstallation: Installation = {
            ...installation,
            configuration: {
                ...installation.configuration,
                ...configuration,
                applications: installation.configuration.applications,
            },
        };

        const tasks: Task[] = [];

        tasks.push({
            title: 'Install dependencies',
            task: async notifier => {
                notifier.update('Installing dependencies');

                try {
                    await this.packageManager.addDependencies(['croct'], true);
                    await this.packageManager.addDependencies([...plan.dependencies, JavaScriptSdk.CONTENT_PACKAGE]);

                    notifier.confirm('Dependencies installed');
                } catch (error) {
                    notifier.alert('Failed to install dependencies', HelpfulError.formatMessage(error));
                }
            },
        });

        tasks.push(...plan.tasks);

        if (Object.keys(configuration.slots).length > 0) {
            tasks.push({
                title: 'Download content',
                task: async notifier => {
                    notifier.update('Downloading content');

                    try {
                        await this.updateContent(resolvedInstallation, {
                            notifier: notifier,
                            clean: true,
                        });
                    } catch (error) {
                        notifier.alert('Failed to download content', HelpfulError.formatMessage(error));
                    }
                },
            });
        }

        if (await this.isTypeScriptProject()) {
            tasks.push({
                title: 'Generate types',
                task: async notifier => {
                    notifier.update('Generating types');

                    try {
                        await this.updateTypes(resolvedInstallation, {
                            notifier: notifier,
                            clean: true,
                        });
                    } catch (error) {
                        notifier.alert('Failed to generate types', HelpfulError.formatMessage(error));
                    }

                    try {
                        await this.registerTypeFile(resolvedInstallation, notifier);
                    } catch (error) {
                        notifier.alert('Failed to register type file', HelpfulError.formatMessage(error));
                    }
                },
            });
        }

        tasks.push({
            title: 'Register script',
            task: async notifier => {
                notifier.update('Registering script');

                try {
                    await this.packageManager.addScript('postinstall', 'croct install');

                    notifier.confirm('Script registered');
                } catch (error) {
                    notifier.alert('Failed to register script', HelpfulError.formatMessage(error));
                }
            },
        });

        if (tasks.length > 0) {
            if (input !== undefined) {
                output.break();
                output.inform('**Installation plan**');

                for (const {title} of tasks) {
                    output.log(` - ${title}`);
                }

                output.break();

                if (!await input.confirm({message: 'Proceed?', default: true})) {
                    return output.exit();
                }
            }

            await output.monitor({tasks: tasks});
        }

        return configuration;
    }

    private async resolvePath(directories: string[], currentPath: string): Promise<string> {
        if (currentPath !== '') {
            return currentPath;
        }

        const parentDirs = ['src'];

        const path = await this.locateFile(
            ...parentDirs.flatMap(dir => directories.map(directory => this.fileSystem.joinPaths(dir, directory))),
            ...directories,
            ...parentDirs,
        );

        if (path === null) {
            return directories[0];
        }

        if (parentDirs.includes(path)) {
            return this.fileSystem.joinPaths(path, directories[0]);
        }

        return path;
    }

    protected abstract getInstallationPlan(installation: Installation): Promise<InstallationPlan>;

    public async update(installation: Installation, options: UpdateOptions = {}): Promise<void> {
        await this.updateContent(installation, options);

        if (await this.isTypeScriptProject()) {
            await this.updateTypes(installation, options);

            if (options.clean === true) {
                await this.registerTypeFile(installation);
            }
        }
    }

    private async updateContent(installation: Installation, options: ContentOptions = {}): Promise<void> {
        const {output, configuration} = installation;
        const notifier = options.notifier ?? output.notify('Updating content');

        const slots = Object.entries(configuration.slots);

        if (slots.length === 0) {
            notifier.confirm('No slots to update');

            return;
        }

        const packageInfo = await this.mountContentPackageFolder();

        if (packageInfo === null) {
            notifier.alert(`The package ${JavaScriptSdk.CONTENT_PACKAGE} is not installed`);

            return;
        }

        const directoryPath = this.fileSystem.joinPaths(packageInfo.directory, 'slot');

        // Delete all subdirectories and files in the slot directory
        for await (const entry of this.fileSystem.list(directoryPath, 0)) {
            if (entry.type === 'directory') {
                await this.fileSystem.delete(this.fileSystem.joinPaths(directoryPath, entry.name), {
                    recursive: true,
                });
            }
        }

        const indexes: Record<string, Record<string, string>> = {};
        const contentImports: Record<string, string> = {};
        const contentVariableMap: Record<string, Record<string, string>> = {};

        for (const [slotId, versionedContent] of Object.entries(await this.loadContent(installation, options.clean))) {
            const latestVersion = Math.max(...versionedContent.map(({version}) => version));

            for (const {version, content: localizedContent} of versionedContent) {
                for (const [locale, content] of Object.entries(localizedContent)) {
                    const baseName = `${slotId}@${version}`;

                    if (indexes[locale] === undefined) {
                        indexes[locale] = {};
                    }

                    const variable = `${formatName(`${slotId}-${locale}`)}V${version}`;
                    const contentFile = `./${locale}/${baseName}`;

                    if (contentVariableMap[locale] === undefined) {
                        contentVariableMap[locale] = {};
                    }

                    indexes[locale][baseName] = contentFile;
                    contentVariableMap[locale][baseName] = `${variable}`;
                    contentImports[variable] = contentFile;

                    if (version === latestVersion) {
                        indexes[locale][slotId] = contentFile;
                        contentVariableMap[locale][slotId] = `${variable}`;
                    }

                    const localeDirectory = this.fileSystem.joinPaths(directoryPath, locale);

                    if (!await this.fileSystem.isDirectory(localeDirectory)) {
                        await this.fileSystem.createDirectory(
                            this.fileSystem.joinPaths(directoryPath, locale),
                            {recursive: true},
                        );
                    }

                    // ESM module
                    await this.fileSystem.writeTextFile(
                        this.fileSystem.joinPaths(directoryPath, locale, `${baseName}.js`),
                        `export default ${JSON.stringify(content, null, 2)};`,
                        {overwrite: true},
                    );

                    // CommonJS module
                    await this.fileSystem.writeTextFile(
                        this.fileSystem.joinPaths(directoryPath, locale, `${baseName}.cjs`),
                        `module.exports = ${JSON.stringify(content, null, 2)};`,
                        {overwrite: true},
                    );
                }
            }
        }

        const es6Imports = Object.entries(contentImports)
            .map(([variable, path]) => `import ${variable} from '${path}.js';`)
            .join('\n');

        const syncContentMap = `const contentMap = ${JSON.stringify(contentVariableMap, null, 2)
            .replace(/(?<=: )"(.*?)"/g, '$1')};\n\n`;

        // ESM module
        await this.fileSystem.writeTextFile(
            this.fileSystem.joinPaths(directoryPath, 'getSlotContent.js'),
            // eslint-disable-next-line prefer-template -- Better readability
            `${es6Imports}\n\n${syncContentMap}`
            // language=javascript
            + multiline`
                const defaultLocale = ${JSON.stringify(configuration.defaultLocale)};

                export function getSlotContent(slotId, language = defaultLocale) {
                    if (contentEntries[language]?.[slotId] !== undefined) {
                        return contentEntries[language][slotId];
                    }

                    if (language !== defaultLocale) {
                        return getSlotContent(slotId);
                    }

                    return null;
                }
            `,
            {overwrite: true},
        );

        const cjImports = Object.entries(contentImports)
            .map(([variable, path]) => `const ${variable} = require('${path}.cjs');`)
            .join('\n');

        // CommonJS module
        await this.fileSystem.writeTextFile(
            this.fileSystem.joinPaths(directoryPath, 'getSlotContent.cjs'),
            // eslint-disable-next-line prefer-template -- Better readability
            `${cjImports}\n\n${syncContentMap}`
            // language=javascript
            + multiline`
                const defaultLocale = ${JSON.stringify(configuration.defaultLocale)};

                module.exports = {
                    getSlotContent: function getSlotContent(slotId, language = defaultLocale) {
                        if (contentEntries[language]?.[slotId] !== undefined) {
                            return contentEntries[language][slotId];
                        }

                        if (language !== defaultLocale) {
                            return getSlotContent(slotId);
                        }

                        return null;
                    }
                };
            `,
            {overwrite: true},
        );

        const asyncEs6ContentMap = `const contentMap = ${JSON.stringify(indexes, null, 2)
            .replace(/"(\.\/.*?)"/g, '() => import("$1.js")')};\n\n`;

        // ESM module
        await this.fileSystem.writeTextFile(
            this.fileSystem.joinPaths(directoryPath, 'loadSlotContent.js'),
            asyncEs6ContentMap
            // language=javascript
            + multiline`
                const defaultLocale = ${JSON.stringify(configuration.defaultLocale)};

                export function loadSlotContent(slotId, language = defaultLocale) {
                    if (contentEntries[language]?.[slotId] !== undefined) {
                        return contentEntries[language][slotId]().then(module => module.default);
                    }

                    if (language !== defaultLocale) {
                        return loadSlotContent(slotId);
                    }

                    return Promise.resolve(null);
                }
            `,
            {overwrite: true},
        );

        const asyncCjsContentMap = `const contentMap = ${JSON.stringify(indexes, null, 2)
            .replace(/"(\.\/.*?)"/g, '() => Promise.resolve(require("$1.cjs"))')};\n\n`;

        // CommonJS module
        await this.fileSystem.writeTextFile(
            this.fileSystem.joinPaths(directoryPath, 'loadSlotContent.cjs'),
            asyncCjsContentMap
            // language=javascript
            + multiline`
                const defaultLocale = ${JSON.stringify(configuration.defaultLocale)};

                module.exports = {
                    loadSlotContent: function loadSlotContent(slotId, language = defaultLocale) {
                        if (contentEntries[language]?.[slotId] !== undefined) {
                            return contentEntries[language][slotId]().then(module => module.default);
                        }

                        if (language !== defaultLocale) {
                            return loadSlotContent(slotId);
                        }

                        return Promise.resolve(null);
                    }
                };
            `,
            {overwrite: true},
        );

        notifier.confirm('Content updated');
    }

    private async loadContent(installation: Installation, update = false): Promise<VersionedContentMap> {
        const {configuration} = installation;

        if (configuration.paths.content === undefined) {
            return this.loadRemoteContent(installation);
        }

        const filePath = this.fileSystem.joinPaths(configuration.paths.content, 'slots.json');

        if (!update && await this.fileSystem.exists(filePath)) {
            return this.loadLocalContent(filePath);
        }

        const content = await this.loadRemoteContent(installation);

        await this.saveContent(content, filePath);

        return content;
    }

    private async saveContent(content: VersionedContentMap, path: string): Promise<void> {
        const directory = this.fileSystem.getDirectoryName(path);

        await this.fileSystem.createDirectory(directory, {recursive: true});

        await this.fileSystem.writeTextFile(
            path,
            JSON.stringify(content, null, 2),
            {overwrite: true},
        );
    }

    private async loadLocalContent(path: string): Promise<VersionedContentMap> {
        let content: string;

        try {
            content = await this.fileSystem.readTextFile(path);
        } catch {
            return {};
        }

        try {
            return JSON.parse(content);
        } catch (error) {
            throw new SdkError('Failed to parse content file.', {
                reason: ErrorReason.INVALID_INPUT,
                cause: error,
                details: [`File: ${path}`],
            });
        }
    }

    private async loadRemoteContent(installation: Installation): Promise<VersionedContentMap> {
        const configuration = await this.resolveVersions(installation.configuration);

        const slots = Object.entries(configuration.slots);
        const slotVersions: Record<string, readonly number[]> = {};

        for (const [slot, versionSpecifier] of slots) {
            slotVersions[slot] = Version.parse(versionSpecifier).getVersions();
        }

        return Object.fromEntries(
            await Promise.all(
                slots.map(
                    async ([slot]) => [
                        slot,
                        await Promise.all(
                            slotVersions[slot].map(
                                version => this.workspaceApi
                                    .getSlotStaticContent(
                                        {
                                            organizationSlug: configuration.organization,
                                            workspaceSlug: configuration.workspace,
                                            slotSlug: slot,
                                        },
                                        version,
                                    )
                                    .then(
                                        (versionedContent): VersionedContent => ({
                                            version: version,
                                            content: Object.fromEntries(
                                                versionedContent.map(({locale, content}) => [locale, content]),
                                            ),
                                        }),
                                    ),
                            ),
                        ),
                    ] as const,
                ),
            ),
        );
    }

    private async updateTypes(installation: Installation, options: ContentOptions = {}): Promise<void> {
        const {output, configuration} = installation;

        const notifier = options.notifier ?? output.notify('Updating types');
        const filePath = this.getTypeFile(configuration.paths.content ?? this.projectDirectory.get());

        if (options.clean === true || !await this.fileSystem.exists(filePath)) {
            let module = '';

            if (Object.keys(configuration.slots).length > 0 || Object.keys(configuration.components).length > 0) {
                module = `${await this.generateTypes(configuration)}`;
            }

            module = multiline`
                /**
                 * Generated by the Croct CLI.
                 *
                 * Any manual changes will be overwritten.
                 *
                 * To regenerate, run \`croct update\`.
                 */

                // module

                export {};
             `.replace('// module', module);

            await this.fileSystem.writeTextFile(filePath, module, {overwrite: true});
        }

        notifier.confirm('Types updated');
    }

    private async generateTypes(configuration: ProjectConfiguration): Promise<string> {
        const {organization, workspace, components, slots} = await this.resolveVersions(configuration);

        return this.workspaceApi.generateTypes({
            organizationSlug: organization,
            workspaceSlug: workspace,
            target: TargetSdk.JAVASCRIPT,
            components: Object.entries(components).map(
                ([component, version]) => ({
                    id: component,
                    version: version,
                }),
            ),
            slots: Object.entries(slots).map(
                ([slot, version]) => ({
                    id: slot,
                    version: version,
                }),
            ),
        });
    }

    private async registerTypeFile(installation: Installation, notifier?: TaskNotifier): Promise<void> {
        const configPath = await this.getTypeScriptConfigPath([
            installation.configuration.paths.components,
            installation.configuration.paths.examples,
        ]);

        const output = notifier ?? installation.output.notify('Registering type file');

        if (configPath === null) {
            throw new SdkError('TypeScript configuration not found');
        }

        const projectDirectory = this.projectDirectory.get();

        if (!this.fileSystem.isSubPath(projectDirectory, configPath)) {
            const relativePath = this.fileSystem.getRelativePath(projectDirectory, configPath);

            throw new SdkError(`TypeScript configuration is outside the project directory: \`${relativePath}\``);
        }

        const directory = installation.configuration.paths.content ?? this.projectDirectory.get();

        const typeFile = this.fileSystem
            .getRelativePath(
                this.fileSystem.getDirectoryName(configPath),
                this.getTypeFile(directory),
            )
            .replace(/\\/g, '/');

        const config = JsonParser.parse(await this.fileSystem.readTextFile(configPath), JsonObjectNode);

        if (config.has('files')) {
            const files = config.get('files', JsonArrayNode);
            const currentFiles = files.toJSON();

            if (currentFiles.includes(typeFile)) {
                return output.confirm('Type file already registered');
            }

            const fileName = this.getTypeFile('.');

            for (let index = 0; index < currentFiles.length; index++) {
                const type = `${currentFiles[index]}`;

                if (type !== typeFile && type.endsWith(fileName)) {
                    currentFiles.splice(index, 1);
                }
            }

            currentFiles.push(typeFile);

            config.set('files', currentFiles);
        } else {
            config.set('files', [typeFile]);
        }

        await this.fileSystem.writeTextFile(configPath, config.toString(), {overwrite: true});

        output.confirm('Type file registered');
    }

    private async resolveVersions(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        const listedComponents = Object.keys(configuration.components);
        const listedSlots = Object.keys(configuration.slots);

        if (listedComponents.length === 0 && listedSlots.length === 0) {
            return configuration;
        }

        const [slots, components] = await Promise.all([
            this.workspaceApi.getSlots({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
            }),
            this.workspaceApi.getComponents({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
            }),
        ]);

        return {
            ...configuration,
            components: Object.fromEntries(
                Object.entries(configuration.components).flatMap<[string, string]>(([slug, version]) => {
                    const versions = Version.parse(version)
                        .getVersions()
                        .filter(
                            major => components.some(
                                component => component.slug === slug
                                    && major <= component.version.major,
                            ),
                        );

                    if (versions.length === 0) {
                        return [];
                    }

                    return [[slug, Version.either(...versions).toString()]];
                }),
            ),
            slots: Object.fromEntries(
                Object.entries(configuration.slots).flatMap<[string, string]>(([slug, version]) => {
                    const versions = Version.parse(version)
                        .getVersions()
                        .filter(
                            major => slots.some(
                                slot => slot.slug === slug
                                    && major <= slot.version.major,
                            ),
                        );

                    if (versions.length === 0) {
                        return [];
                    }

                    return [[slug, Version.either(...versions).toString()]];
                }),
            ),
        };
    }

    private async mountContentPackageFolder(): Promise<Dependency | null> {
        const packageInfo = await this.packageManager.getDependency(JavaScriptSdk.CONTENT_PACKAGE);

        if (packageInfo === null) {
            return null;
        }

        if (await this.fileSystem.isSymbolicLink(packageInfo.directory)) {
            // Package managers like PNPM create symlinks to the global cache.
            // Because the content is project-specific, create a local copy of the package
            // to avoid conflicts with other projects.
            const realPath = await this.fileSystem.getRealPath(packageInfo.directory);

            await this.fileSystem.delete(packageInfo.directory);
            await this.fileSystem.copy(realPath, packageInfo.directory);
        }

        return packageInfo;
    }

    protected async locateFile(...fileNames: string[]): Promise<string | null> {
        const directory = this.projectDirectory.get();

        for (const filename of fileNames) {
            if (this.fileSystem.isAbsolutePath(filename)) {
                throw new SdkError('The file path must be relative');
            }

            const fullPath = this.fileSystem.joinPaths(directory, filename);

            if (await this.fileSystem.exists(fullPath)) {
                return filename;
            }
        }

        return null;
    }

    protected async readFile(...fileNames: string[]): Promise<string | null> {
        const filePath = await this.locateFile(...fileNames);

        if (filePath === null) {
            return null;
        }

        return this.fileSystem.readTextFile(
            this.fileSystem.joinPaths(this.projectDirectory.get(), filePath),
        );
    }

    private getTypeFile(path: string): string {
        return this.fileSystem.joinPaths(path, 'slots.d.ts');
    }

    protected isTypeScriptProject(): Promise<boolean> {
        return this.packageManager.hasDirectDependency('typescript');
    }

    private async getTypeScriptConfigPath(sourcePaths: string[] = []): Promise<string | null> {
        const workingDirectory = this.projectDirectory.get();
        const config = await this.importConfigLoader.load(workingDirectory, {
            fileNames: ['tsconfig.json'],
            sourcePaths: sourcePaths.length === 0
                ? [workingDirectory]
                : sourcePaths,
        });

        if (config === null) {
            return null;
        }

        return config.matchedConfigPath;
    }
}
