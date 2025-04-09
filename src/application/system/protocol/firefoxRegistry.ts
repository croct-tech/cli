import {parse} from 'ini';
import {ProtocolHandler, ProtocolRegistry, ProtocolRegistryError} from '@/application/system/protocol/protocolRegistry';
import {FileSystem} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';
import {Process} from '@/application/system/process/process';

export type Configuration = {
    fileSystem: FileSystem,
    appDirectory: string,
    appPath: string,
};

export type PartialConfiguration = Omit<Configuration, 'appDirectory'>;

export type MacOsConfiguration = PartialConfiguration & {
    homeDirectory: string,
};

export type WindowsConfiguration = PartialConfiguration & {
    appDataDirectory: string,
};

export type LinuxConfiguration = PartialConfiguration & {
    homeDirectory: string,
};

type Handlers = {
    schemes: Record<string, {
        action?: number|string,
        ask?: boolean,
        stubEntry?: boolean,
        handlers: Array<null|{
            name: string,
            uriTemplate?: string,
            path?: string,
        }>,
    }>,
};

export class FirefoxRegistry implements ProtocolRegistry {
    private static readonly PREFERENCES = [
        'user_pref("network.protocol-handler.expose.%protocol%", false);',
        'user_pref("network.protocol-handler.external.%protocol%", true);',
    ];

    private readonly fileSystem: FileSystem;

    private readonly profileDirectory: string;

    private readonly configuration: Omit<Configuration, 'appDirectory' | 'fileSystem'>;

    public constructor({fileSystem, appDirectory, ...configuration}: Configuration) {
        this.fileSystem = fileSystem;
        this.profileDirectory = appDirectory;
        this.configuration = configuration;
    }

    public static fromSystem(process: Process, configuration: PartialConfiguration): FirefoxRegistry {
        switch (process.getPlatform()) {
            case 'win32': {
                const dataDirectory = process.getEnvValue('APPDATA') ?? process.getEnvValue('USERPROFILE');

                if (dataDirectory === null) {
                    throw new ProtocolRegistryError('Cannot determine the user profile directory.', {
                        reason: ErrorReason.PRECONDITION,
                    });
                }

                return FirefoxRegistry.windows({
                    ...configuration,
                    appDataDirectory: dataDirectory,
                });
            }

            case 'darwin': {
                const home = process.getEnvValue('HOME');

                if (home === null) {
                    throw new ProtocolRegistryError('Cannot determine the user home directory.', {
                        reason: ErrorReason.PRECONDITION,
                    });
                }

                return FirefoxRegistry.macOs({
                    ...configuration,
                    homeDirectory: home,
                });
            }

            case 'linux': {
                const home = process.getEnvValue('HOME');

                if (home === null) {
                    throw new ProtocolRegistryError('Cannot determine the user home directory.', {
                        reason: ErrorReason.PRECONDITION,
                    });
                }

                return FirefoxRegistry.linux({
                    ...configuration,
                    homeDirectory: home,
                });
            }

            default:
                throw new ProtocolRegistryError(`Platform \`${process.getPlatform()}\` is not supported.`, {
                    reason: ErrorReason.NOT_SUPPORTED,
                });
        }
    }

    public static windows(configuration: WindowsConfiguration): FirefoxRegistry {
        return new FirefoxRegistry({
            ...configuration,
            appDirectory: configuration.fileSystem.joinPaths(
                configuration.appDataDirectory,
                'Mozilla',
                'Firefox',
            ),
        });
    }

    public static macOs(configuration: MacOsConfiguration): FirefoxRegistry {
        return new FirefoxRegistry({
            ...configuration,
            appDirectory: configuration.fileSystem.joinPaths(
                configuration.homeDirectory,
                'Library',
                'Application Support',
                'Firefox',
            ),
        });
    }

    public static linux(configuration: LinuxConfiguration): FirefoxRegistry {
        return new FirefoxRegistry({
            ...configuration,
            appDirectory: configuration.fileSystem.joinPaths(
                configuration.homeDirectory,
                'snap',
                'firefox',
                'common',
                '.mozilla',
                'firefox',
            ),
        });
    }

    public async isRegistered(protocol: string): Promise<boolean> {
        const profilePath = await this.getProfilePath();

        if (profilePath === null) {
            return false;
        }

        const preferencesPath = this.getUserPreferencesFilePath(profilePath);

        const preferences = await this.fileSystem
            .readTextFile(preferencesPath)
            .catch(() => '');

        for (const preference of this.getPreferences(protocol)) {
            if (!preferences.includes(preference)) {
                return false;
            }
        }

        return true;
    }

    public async register(handler: ProtocolHandler): Promise<void> {
        if (await this.isRegistered(handler.protocol)) {
            return;
        }

        const profilePath = await this.getProfilePath();

        if (profilePath === null) {
            throw new ProtocolRegistryError('Cannot find the default profile file.', {
                reason: ErrorReason.NOT_FOUND,
            });
        }

        const preferencesPath = this.getUserPreferencesFilePath(profilePath);
        const handlersPath = this.getHandlersFilePath(profilePath);

        const [preferencesData, handlersData] = await Promise.all([
            await this.fileSystem
                .readTextFile(preferencesPath)
                .catch(() => ''),
            this.fileSystem
                .readTextFile(handlersPath)
                .catch(() => ''),
        ]);

        const newPreferences = `${preferencesData}\n${this.getPreferences(handler.protocol).join('\n')}`;

        await this.fileSystem.writeTextFile(preferencesPath, newPreferences, {
            overwrite: true,
        });

        const handlers = FirefoxRegistry.parseHandlers(handlersData);

        handlers.schemes[handler.protocol] = {
            ask: true,
            action: 2,
            handlers: [
                {
                    name: handler.name,
                    path: this.configuration.appPath,
                },
            ],
        };

        await this.fileSystem.writeTextFile(handlersPath, JSON.stringify(handlers), {
            overwrite: true,
        });
    }

    public async unregister(protocol: string): Promise<void> {
        if (!await this.isRegistered(protocol)) {
            return;
        }

        const profilePath = await this.getProfilePath();

        if (profilePath === null) {
            return;
        }

        const preferencesPath = this.getUserPreferencesFilePath(profilePath);
        const handlersPath = this.getHandlersFilePath(profilePath);

        const [preferencesData, handlersData] = await Promise.all([
            await this.fileSystem
                .readTextFile(preferencesPath)
                .catch(() => ''),
            this.fileSystem
                .readTextFile(handlersPath)
                .catch(() => ''),
        ]);

        const newPreferences = preferencesData
            .split('\n')
            .filter(line => !this.getPreferences(protocol).includes(line))
            .join('\n');

        await this.fileSystem.writeTextFile(preferencesPath, newPreferences, {
            overwrite: true,
        });

        const handlers = FirefoxRegistry.parseHandlers(handlersData);

        if (handlers.schemes[protocol] !== undefined) {
            delete handlers.schemes[protocol];

            await this.fileSystem.writeTextFile(handlersPath, JSON.stringify(handlers), {
                overwrite: true,
            });
        }
    }

    private getUserPreferencesFilePath(profilePath: string): string {
        return this.fileSystem.joinPaths(profilePath, 'user.js');
    }

    private getHandlersFilePath(profilePath: string): string {
        return this.fileSystem.joinPaths(profilePath, 'handlers.json');
    }

    private async getProfilePath(): Promise<string|null> {
        const profilesIniPath = this.getPath('profiles.ini');

        if (!await this.fileSystem.exists(profilesIniPath)) {
            return null;
        }

        const sections = Object.values(parse(await this.fileSystem.readTextFile(profilesIniPath)));
        const defaults: string[] = [];
        const paths: string[] = [];

        for (const section of sections) {
            if (section.Default !== undefined) {
                defaults.push(section.Default);
            }

            if (section.Path !== undefined) {
                if (section.Default === '1') {
                    paths.unshift(section.Path);
                } else {
                    paths.push(section.Path);
                }
            }
        }

        if (paths.length === 0) {
            return null;
        }

        let resolvedPath = paths[0];

        for (const path of paths) {
            if (defaults.includes(path)) {
                resolvedPath = path;

                break;
            }
        }

        return this.getPath(resolvedPath);
    }

    private getPath(path: string): string {
        return this.fileSystem.joinPaths(this.profileDirectory, path);
    }

    private getPreferences(protocolName: string): string[] {
        return FirefoxRegistry.PREFERENCES.map(preference => preference.replace(/%protocol%/g, protocolName));
    }

    private static parseHandlers(handlers: string): Handlers {
        let result: Handlers;

        try {
            result = JSON.parse(handlers);
        } catch {
            return {
                schemes: {},
            };
        }

        if (typeof result !== 'object' || result === null) {
            return {
                schemes: {},
            };
        }

        if (!('schemes' in result) || typeof result.schemes !== 'object' || result.schemes === null) {
            return {
                ...result,
                schemes: {},
            };
        }

        return result;
    }
}
