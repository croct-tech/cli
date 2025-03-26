import {ProtocolHandler, ProtocolRegistry, ProtocolRegistryError} from '@/application/system/protocol/protocolRegistry';
import {FileSystem} from '@/application/fs/fileSystem';
import {multiline} from '@/utils/multiline';
import {CommandExecutor} from '@/application/system/process/executor';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Command} from '@/application/system/process/command';

export type Configuration = {
    fileSystem: FileSystem,
    commandExecutor: CommandExecutor,
    appDirectory: string,
};

export class MacOsRegistry implements ProtocolRegistry {
    private readonly fileSystem: FileSystem;

    private readonly commandExecutor: CommandExecutor;

    private readonly appDirectory: string;

    public constructor({fileSystem, commandExecutor, appDirectory}: Configuration) {
        this.fileSystem = fileSystem;
        this.commandExecutor = commandExecutor;
        this.appDirectory = appDirectory;
    }

    public async isRegistered(protocol: string): Promise<boolean> {
        return (await this.findLauncher(protocol)) !== null;
    }

    public async register(handler: ProtocolHandler): Promise<void> {
        if (await this.isRegistered(handler.protocol)) {
            return;
        }

        try {
            await this.install(handler);
        } catch (error) {
            throw new ProtocolRegistryError('Failed to register protocol handler.', {
                cause: error,
            });
        }
    }

    public async unregister(protocol: string): Promise<void> {
        const launcher = await this.findLauncher(protocol);

        if (launcher === null) {
            return;
        }

        const launcherPath = this.getLauncherAppPath(protocol);

        if (launcher !== launcherPath) {
            throw new ProtocolRegistryError(
                `Application registered for protocol \`${protocol}\` is externally managed.`,
                {
                    reason: ErrorReason.PRECONDITION,
                },
            );
        }

        try {
            await this.fileSystem.delete(launcherPath, {recursive: true});
            await this.fileSystem.delete(this.getHandlerAppPath(protocol), {recursive: true});
        } catch (error) {
            throw new ProtocolRegistryError('Failed to unregister protocol handler.', {
                cause: error,
            });
        }
    }

    private async install(handler: ProtocolHandler): Promise<void> {
        const launcherPath = this.getLauncherAppPath(handler.protocol);
        const handlerPath = this.getHandlerAppPath(handler.protocol);
        const launcherApp = this.createLauncherApp(handler, handlerPath);
        const handlerApp = this.createHandlerApp(handler);

        const tempDirectory = await this.fileSystem.createTemporaryDirectory('protocol');

        const launcherScript = this.fileSystem.joinPaths(tempDirectory, 'launcher.scpt');
        const handlerScript = this.fileSystem.joinPaths(tempDirectory, 'handler.scpt');

        await this.fileSystem.writeTextFile(launcherScript, launcherApp);
        await this.fileSystem.writeTextFile(handlerScript, handlerApp);

        await this.fileSystem.createDirectory(this.appDirectory, {recursive: true});

        await this.execute({
            name: 'osacompile',
            arguments: ['-o', launcherPath, launcherScript],
        });

        await this.execute({
            name: 'osacompile',
            arguments: ['-o', handlerPath, handlerScript],
        });

        await this.execute({
            name: 'plutil',
            arguments: [
                '-insert',
                'CFBundleURLTypes',
                '-json',
                JSON.stringify([{
                    CFBundleURLName: MacOsRegistry.formatId(handler.id),
                    CFBundleURLSchemes: [handler.protocol],
                }]),
                `${launcherPath}/Contents/Info.plist`,
            ],
        });

        await this.execute({
            name: 'open',
            arguments: ['-g', launcherPath],
        });
    }

    private async findLauncher(protocol: string): Promise<string|null> {
        const result = await this.execute({
            name: 'osascript',
            arguments: [
                '-e',
                // language=AppleScript
                multiline`
                  use AppleScript version "2.4"
                  use framework "Foundation"
                  use framework "AppKit"

                  set protocolName to "${protocol}:test"
                  set workspace to current application's NSWorkspace's sharedWorkspace()
                  set protocolURL to current application's |NSURL|'s URLWithString:protocolName
                  set appUrl to workspace's URLForApplicationToOpenURL:protocolURL

                  if appUrl = missing value then
                    return ""
                  end if
                  
                  return appUrl's path as text
                `,
            ],
        });

        const path = result.trim();

        if (path === '') {
            return null;
        }

        return path;
    }

    private async execute(command: Command): Promise<string> {
        const execution = this.commandExecutor.run(command);

        if (await execution.wait() !== 0) {
            throw new HelpfulError(`Failed to execute command \`${command.name}\`.`);
        }

        return execution.read();
    }

    private createLauncherApp(handler: ProtocolHandler, handlerAppPath: string): string {
        const id = MacOsRegistry.formatId(handler.id);

        // language=AppleScript
        return multiline`
            on open location this_URL
                do shell script "defaults write ${id} current_url " & quoted form of this_URL
                tell application "${handlerAppPath}" to activate
            end open location
        `;
    }

    private createHandlerApp(handler: ProtocolHandler): string {
        const id = MacOsRegistry.formatId(handler.id);
        const command = handler.command.replace(/\$url/, '" & quoted form of this_URL & "');

        // language=AppleScript
        return multiline`
            set this_URL to do shell script "defaults read ${id} current_url"
            tell application "Terminal"
              do script "${command}"
              activate
            end tell
        `;
    }

    private getLauncherAppPath(protocol: string): string {
        return this.getAppPath(`${protocol}`);
    }

    private getHandlerAppPath(protocol: string): string {
        return this.getAppPath(`${protocol}-handler`);
    }

    private getAppPath(name: string): string {
        return this.fileSystem.joinPaths(this.appDirectory, `${name}.app`);
    }

    private static formatId(id: string): string {
        return id.split(/[^a-zA-Z0-9]+/g)
            .join('.');
    }
}
