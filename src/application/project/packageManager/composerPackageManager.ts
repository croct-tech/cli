import semver from 'semver';
import {JsonObjectNode, JsonParser} from '@croct/json5-parser';
import type {
    AddDependencyOptions,
    Dependency,
    InstallDependenciesOptions,
    PackageManager,
    UpdateCommandOptions,
    UpdatePackageOptions,
} from '@/application/project/packageManager/packageManager';
import {PackageManagerError} from '@/application/project/packageManager/packageManager';
import type {FileSystem} from '@/application/fs/fileSystem';
import type {Validator} from '@/application/validation';
import {ErrorReason} from '@/application/error';
import type {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import type {PackageManagerAgent} from '@/application/project/packageManager/agent/packageManagerAgent';
import type {Command} from '@/application/system/process/command';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    packageValidator: Validator<PartialComposerManifest>,
    lockValidator: Validator<ComposerLock>,
    fileSystem: FileSystem,
    agent: PackageManagerAgent,
};

export type PartialComposerManifest = {
    name?: string,
    version?: string,
    type?: string,
    require?: Record<string, string>,
    'require-dev'?: Record<string, string>,
    scripts?: Record<string, unknown>,
    autoload?: {
        'psr-4'?: Record<string, string | string[]>,
    },
    bin?: string | string[],
    extra?: Record<string, unknown>,
};

export type ComposerLock = {
    packages?: Array<{provide?: Record<string, string>}>,
    'packages-dev'?: Array<{provide?: Record<string, string>}>,
};

/**
 * Composer-backed implementation of the package manager.
 *
 * Reads dependencies from the `composer.json` manifest and resolves installed
 * packages under the `vendor` directory, delegating command execution to a
 * Composer agent.
 */
export class ComposerPackageManager implements PackageManager {
    /**
     * Default providers for PSR virtual implementation packages, chosen to add the
     * fewest dependencies from a single vendor: `guzzlehttp/guzzle` provides the
     * PSR-18 client and pulls `guzzlehttp/psr7` (PSR-17 factory + PSR-7 message).
     */
    private static readonly DEFAULT_PROVIDERS: Record<string, string> = {
        'psr/http-client-implementation': 'guzzlehttp/guzzle',
        'psr/http-factory-implementation': 'guzzlehttp/guzzle',
        'psr/http-message-implementation': 'guzzlehttp/guzzle',
    };

    private readonly projectDirectory: WorkingDirectory;

    private readonly fileSystem: FileSystem;

    private readonly agent: PackageManagerAgent;

    private readonly packageValidator: Validator<PartialComposerManifest>;

    private readonly lockValidator: Validator<ComposerLock>;

    public constructor(configuration: Configuration) {
        this.projectDirectory = configuration.projectDirectory;
        this.fileSystem = configuration.fileSystem;
        this.agent = configuration.agent;
        this.packageValidator = configuration.packageValidator;
        this.lockValidator = configuration.lockValidator;
    }

    public getName(): Promise<string> {
        return this.agent.getName();
    }

    public isInstalled(): Promise<boolean> {
        return this.agent.isInstalled();
    }

    public isProject(): Promise<boolean> {
        return this.fileSystem.exists(this.getProjectManifestPath());
    }

    public async addDependencies(dependencies: string[], options?: AddDependencyOptions): Promise<void> {
        const resolved = await this.resolveImplementations(dependencies);

        if (resolved.length > 0) {
            await this.agent.addDependencies(resolved, options);
        }
    }

    /**
     * Resolves PSR virtual implementation packages to concrete providers.
     *
     * A virtual package (e.g. `psr/http-client-implementation`) cannot be required
     * directly: it is dropped when an installed package already provides it, and
     * otherwise replaced by a default provider. Real package names pass through.
     */
    private async resolveImplementations(dependencies: string[]): Promise<string[]> {
        const resolved: string[] = [];

        for (const dependency of dependencies) {
            const provider = ComposerPackageManager.DEFAULT_PROVIDERS[dependency];

            if (provider === undefined) {
                resolved.push(dependency);
            } else if (!await this.hasDependency(dependency)) {
                resolved.push(provider);
            }
        }

        return [...new Set(resolved)];
    }

    public installDependencies(options?: InstallDependenciesOptions): Promise<void> {
        return this.agent.installDependencies(options);
    }

    public updatePackage(packageName: string, options?: UpdatePackageOptions): Promise<void> {
        return this.agent.updatePackage(packageName, options);
    }

    public getPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return this.agent.getPackageCommand(packageName, args);
    }

    public getScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return this.agent.getScriptCommand(script, args);
    }

    public getPackageUpdateCommand(packageName: string, options?: UpdateCommandOptions): Promise<Command> {
        return this.agent.getPackageUpdateCommand(packageName, options);
    }

    public async hasDirectDependency(name: string, version?: string): Promise<boolean> {
        const manifest = await this.readManifest(this.getProjectManifestPath());

        if (manifest?.require?.[name] === undefined && manifest?.['require-dev']?.[name] === undefined) {
            return false;
        }

        if (version === undefined) {
            return true;
        }

        return this.hasDependency(name, version);
    }

    public async hasDependency(name: string, version?: string): Promise<boolean> {
        const info = await this.getDependency(name);

        if (info !== null) {
            if (version === undefined || info.version === null) {
                return version === undefined;
            }

            return semver.satisfies(info.version, version);
        }

        // Virtual packages (e.g. `psr/http-client-implementation`) have no `vendor/<name>`
        // entry; check whether any installed package declares them under `provide`.
        return this.isProvided(name);
    }

    private async isProvided(name: string): Promise<boolean> {
        const lock = await this.readLock();

        return [...(lock.packages ?? []), ...(lock['packages-dev'] ?? [])]
            .some(entry => entry.provide?.[name] !== undefined);
    }

    private async readLock(): Promise<ComposerLock> {
        const path = this.fileSystem.joinPaths(this.projectDirectory.get(), 'composer.lock');

        if (!await this.fileSystem.exists(path)) {
            return {};
        }

        let data: unknown;

        try {
            data = JSON.parse(await this.fileSystem.readTextFile(path));
        } catch {
            return {};
        }

        const result = await this.lockValidator.validate(data);

        return result.valid ? result.data : {};
    }

    public async getDependency(name: string): Promise<Dependency | null> {
        const manifestPath = this.getVendorManifestPath(name);
        const manifest = await this.readManifest(manifestPath);

        if (manifest === null) {
            return null;
        }

        return {
            name: manifest.name ?? name,
            version: manifest.version ?? null,
            directory: this.fileSystem.getDirectoryName(manifestPath),
            metadata: manifest,
        };
    }

    public async getScripts(): Promise<Record<string, string>> {
        const manifest = await this.readManifest(this.getProjectManifestPath());

        if (manifest?.scripts === undefined) {
            return {};
        }

        const scripts: Record<string, string> = {};

        for (const [name, value] of Object.entries(manifest.scripts)) {
            if (typeof value === 'string') {
                scripts[name] = value;
            } else if (Array.isArray(value) && value.every((item): item is string => typeof item === 'string')) {
                scripts[name] = value.join(' && ');
            }
        }

        return scripts;
    }

    public async addScript(name: string, script: string): Promise<void> {
        const manifestFile = this.getProjectManifestPath();

        if (!await this.fileSystem.exists(manifestFile)) {
            throw new PackageManagerError('Composer manifest not found in the project.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `File: ${manifestFile}`,
                ],
            });
        }

        const manifest = JsonParser.parse(await this.fileSystem.readTextFile(manifestFile), JsonObjectNode);

        if (!manifest.has('scripts')) {
            manifest.set('scripts', {});
        }

        const scripts = manifest.get('scripts', JsonObjectNode);

        if (scripts.has(name)) {
            const current = scripts.get(name).toJSON();

            if (typeof current === 'string') {
                if (current === script) {
                    // The script is already registered.
                    return;
                }

                scripts.set(name, [current, script]);
            } else if (Array.isArray(current)) {
                if (current.includes(script)) {
                    // The script is already registered.
                    return;
                }

                scripts.set(name, [...current, script]);
            } else {
                scripts.set(name, script);
            }
        } else {
            scripts.set(name, script);
        }

        await this.fileSystem.writeTextFile(manifestFile, manifest.toString(), {overwrite: true});
    }

    private getProjectManifestPath(): string {
        return this.fileSystem.joinPaths(this.projectDirectory.get(), 'composer.json');
    }

    private getVendorManifestPath(name: string): string {
        return this.fileSystem.joinPaths(this.projectDirectory.get(), 'vendor', name, 'composer.json');
    }

    private async readManifest(path: string): Promise<PartialComposerManifest | null> {
        if (!await this.fileSystem.exists(path)) {
            return null;
        }

        let data: unknown;

        try {
            data = JSON.parse(await this.fileSystem.readTextFile(path));
        } catch {
            return null;
        }

        const result = await this.packageValidator.validate(data);

        if (!result.valid) {
            return null;
        }

        return result.data;
    }
}
