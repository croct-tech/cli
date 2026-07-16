import type {FileSystem} from '@/application/fs/fileSystem';
import type {Validator, ValidationResult} from '@/application/validation';
import {VirtualizedWorkingDirectory} from '@/application/fs/workingDirectory/virtualizedWorkingDirectory';
import type {
    JsonProjectConfiguration,
    JsonPartialProjectConfiguration,
} from '@/application/project/configuration/manager/jsonConfigurationFileManager';
import {JsonConfigurationFileManager} from '@/application/project/configuration/manager/jsonConfigurationFileManager';
import type {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';

describe('JsonConfigurationFileManager', () => {
    const configuration: ProjectConfiguration = {
        organization: 'org',
        workspace: 'workspace',
        applications: {
            development: 'dev',
        },
        defaultLocale: 'en',
        locales: ['en'],
        slots: {},
        components: {},
    };

    function createFileSystem(files: Map<string, string>): FileSystem {
        return {
            exists: (path: string): Promise<boolean> => Promise.resolve(files.has(path)),
            readTextFile: (path: string): Promise<string> => {
                const content = files.get(path);

                if (content === undefined) {
                    return Promise.reject(new Error(`File not found: ${path}`));
                }

                return Promise.resolve(content);
            },
            writeTextFile: (path: string, content: string): Promise<void> => {
                files.set(path, content);

                return Promise.resolve();
            },
            isAbsolutePath: (path: string): boolean => path.startsWith('/'),
            joinPaths: (...paths: string[]): string => paths.join('/'),
        } as Partial<FileSystem> as FileSystem;
    }

    function createValidator<T>(): Validator<T> {
        return {
            validate: (data: unknown): ValidationResult<T> => ({
                valid: true,
                data: data as T,
            }),
        };
    }

    it('should resolve the configuration file against the current project directory', async () => {
        const files = new Map<string, string>();
        const projectDirectory = new VirtualizedWorkingDirectory('/initial');

        const manager = new JsonConfigurationFileManager({
            fileSystem: createFileSystem(files),
            projectDirectory: projectDirectory,
            fullValidator: createValidator<JsonProjectConfiguration>(),
            partialValidator: createValidator<JsonPartialProjectConfiguration>(),
            configurationFile: 'croct.json',
        });

        projectDirectory.setCurrentDirectory('/initial/project');

        await manager.update(configuration);

        expect(files.has('/initial/croct.json')).toBe(false);
        expect(files.has('/initial/project/croct.json')).toBe(true);
    });

    it('should load the configuration from the current project directory', async () => {
        const files = new Map<string, string>();
        const projectDirectory = new VirtualizedWorkingDirectory('/initial');

        const manager = new JsonConfigurationFileManager({
            fileSystem: createFileSystem(files),
            projectDirectory: projectDirectory,
            fullValidator: createValidator<JsonProjectConfiguration>(),
            partialValidator: createValidator<JsonPartialProjectConfiguration>(),
            configurationFile: 'croct.json',
        });

        files.set('/initial/project/croct.json', JSON.stringify(configuration));

        await expect(manager.isInitialized()).resolves.toBe(false);

        projectDirectory.setCurrentDirectory('/initial/project');

        await expect(manager.isInitialized()).resolves.toBe(true);
        await expect(manager.load()).resolves.toEqual(configuration);
    });

    it('should use an absolute configuration file path as given', async () => {
        const files = new Map<string, string>();
        const projectDirectory = new VirtualizedWorkingDirectory('/initial');

        const manager = new JsonConfigurationFileManager({
            fileSystem: createFileSystem(files),
            projectDirectory: projectDirectory,
            fullValidator: createValidator<JsonProjectConfiguration>(),
            partialValidator: createValidator<JsonPartialProjectConfiguration>(),
            configurationFile: '/custom/croct.json',
        });

        projectDirectory.setCurrentDirectory('/initial/project');

        await manager.update(configuration);

        expect(files.has('/custom/croct.json')).toBe(true);
    });
});
