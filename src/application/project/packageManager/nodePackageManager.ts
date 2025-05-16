import semver from 'semver';
import {JsonObjectNode, JsonParser} from '@croct/json5-parser';
import {Dependency, PackageManager, PackageManagerError} from '@/application/project/packageManager/packageManager';
import {FileSystem} from '@/application/fs/fileSystem';
import {Validator} from '@/application/validation';
import {ErrorReason} from '@/application/error';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {PackageManagerAgent} from '@/application/project/packageManager/agent/packageManagerAgent';
import {Command} from '@/application/system/process/command';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    packageValidator: Validator<PartialNpmManifest>,
    fileSystem: FileSystem,
    agent: PackageManagerAgent,
};

export type PartialNpmManifest = {
    name: string,
    version?: string,
    dependencies?: Record<string, string>,
    devDependencies?: Record<string, string>,
    bin?: Record<string, string>,
    scripts?: Record<string, string>,
};

export class NodePackageManager implements PackageManager {
    private readonly projectDirectory: WorkingDirectory;

    private readonly fileSystem: FileSystem;

    private readonly agent: PackageManagerAgent;

    private readonly packageValidator: Validator<PartialNpmManifest>;

    private readonly manifestPath: Map<string, string|null> = new Map();

    public constructor(configuration: Configuration) {
        this.projectDirectory = configuration.projectDirectory;
        this.fileSystem = configuration.fileSystem;
        this.agent = configuration.agent;
        this.packageValidator = configuration.packageValidator;
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

    public addDependencies(dependencies: string[], dev?: boolean): Promise<void> {
        return this.agent.addDependencies(dependencies, dev);
    }

    public installDependencies(): Promise<void> {
        return this.agent.installDependencies();
    }

    public getPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return this.agent.getPackageCommand(packageName, args);
    }

    public getScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return this.agent.getScriptCommand(script, args);
    }

    public async hasDirectDependency(name: string, version?: string): Promise<boolean> {
        const manifest = await this.readManifest(this.getProjectManifestPath());

        if (manifest?.dependencies?.[name] === undefined && manifest?.devDependencies?.[name] === undefined) {
            return false;
        }

        if (version === undefined) {
            return true;
        }

        return this.hasDependency(name, version);
    }

    public async hasDependency(name: string, version?: string): Promise<boolean> {
        const info = await this.getDependency(name);

        if (info === null) {
            return false;
        }

        if (version === undefined || info.version === null) {
            return version === undefined;
        }

        return version === undefined || (info.version !== null && semver.satisfies(info.version, version));
    }

    public async getDependency(name: string): Promise<Dependency | null> {
        const manifestPath = await this.findPackageManifestPath(name);

        if (manifestPath === null) {
            return null;
        }

        const info = await this.readManifest(manifestPath);

        if (info === null) {
            return null;
        }

        return {
            name: info.name,
            version: info.version ?? null,
            directory: this.fileSystem.getDirectoryName(manifestPath),
            metadata: info,
        };
    }

    public async getScripts(): Promise<Record<string, string>> {
        const manifest = await this.readManifest(this.getProjectManifestPath());

        if (manifest === null) {
            return {};
        }

        return manifest.scripts ?? {};
    }

    public async addScript(name: string, script: string): Promise<void> {
        const packageFile = this.getProjectManifestPath();

        if (!await this.fileSystem.exists(packageFile)) {
            throw new PackageManagerError('Package file not found in the project.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `File: ${packageFile}`,
                ],
            });
        }

        const content = await this.fileSystem.readTextFile(packageFile);

        const packageJson = JsonParser.parse(content, JsonObjectNode);

        if (packageJson.has('scripts')) {
            const scripts = packageJson.get('scripts', JsonObjectNode);

            let command = script;

            if (scripts.has(name)) {
                const postInstall = scripts.get(name);
                const value = postInstall.toJSON();

                if (typeof value === 'string' && value.includes(script)) {
                    // The script is already present in the package file
                    return;
                }

                command = `${value} && ${script}`;
            }

            scripts.set(name, command);
        } else {
            packageJson.set('scripts', {[name]: script});
        }

        await this.fileSystem.writeTextFile(packageFile, packageJson.toString(), {overwrite: true});
    }

    private async findPackageManifestPath(name: string, directory?: string): Promise<string|null> {
        const currentDirectory = directory ?? this.projectDirectory.get();
        const packagePath = this.fileSystem.joinPaths(currentDirectory, 'node_modules', name, 'package.json');
        const cachedPath = this.manifestPath.get(packagePath);

        if (cachedPath !== undefined) {
            return cachedPath;
        }

        let resolvedPath: string|null = packagePath;

        if (!await this.fileSystem.exists(packagePath)) {
            const parentDirectory = this.fileSystem.getDirectoryName(currentDirectory);

            resolvedPath = parentDirectory !== currentDirectory
                ? await this.findPackageManifestPath(name, parentDirectory)
                : null;
        }

        this.manifestPath.set(packagePath, resolvedPath);

        return resolvedPath;
    }

    private getProjectManifestPath(): string {
        return this.fileSystem.joinPaths(this.projectDirectory.get(), 'package.json');
    }

    private async readManifest(path: string): Promise<PartialNpmManifest | null> {
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
