import {ProtocolHandler, ProtocolRegistry, ProtocolRegistryError} from '@/application/system/protocol/protocolRegistry';
import {FileSystem} from '@/application/fs/fileSystem';
import {CommandExecutor} from '@/application/system/process/executor';
import {multiline} from '@/application/utils';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Command} from '@/application/system/process/command';

export type Configuration = {
    fileSystem: FileSystem,
    commandExecutor: CommandExecutor,
    homeDirectory: string,
};

export class LinuxRegistry implements ProtocolRegistry {
    private static readonly COMMAND = 'gnome-terminal -- bash --login -ic ';

    private readonly fileSystem: FileSystem;

    private readonly commandExecutor: CommandExecutor;

    private readonly homeDirectory: string;

    public constructor({fileSystem, commandExecutor, homeDirectory}: Configuration) {
        this.fileSystem = fileSystem;
        this.commandExecutor = commandExecutor;
        this.homeDirectory = homeDirectory;
    }

    public async isRegistered(protocol: string): Promise<boolean> {
        return (await this.findDesktopEntry(protocol)) !== null;
    }

    public async register(handler: ProtocolHandler): Promise<void> {
        if (await this.isRegistered(handler.protocol)) {
            throw new ProtocolRegistryError(`Protocol \`${handler.protocol}\` is already registered.`, {
                reason: ErrorReason.PRECONDITION,
            });
        }

        try {
            await this.fileSystem.writeTextFile(
                this.getDesktopEntryPath(handler.protocol),
                LinuxRegistry.createDesktopEntry(handler),
            );

            await this.updateDesktopDatabase();
        } catch (error) {
            throw new ProtocolRegistryError('Failed to register protocol handler.', {
                cause: error,
            });
        }
    }

    public async unregister(protocol: string): Promise<void> {
        const currentEntryPath = await this.findDesktopEntry(protocol);

        if (currentEntryPath === null) {
            return;
        }

        const command = await this.getCommand(currentEntryPath);
        const entryPath = this.getDesktopEntryPath(protocol);

        if (currentEntryPath !== entryPath || command?.startsWith(LinuxRegistry.COMMAND) !== true) {
            throw new ProtocolRegistryError(
                `Application registered for protocol \`${protocol}\` is externally managed.`,
                {
                    reason: ErrorReason.PRECONDITION,
                },
            );
        }

        try {
            await this.fileSystem.delete(currentEntryPath);
            await this.updateDesktopDatabase();
        } catch (error) {
            throw new ProtocolRegistryError('Failed to unregister protocol handler.', {
                cause: error,
            });
        }
    }

    private async updateDesktopDatabase(): Promise<void> {
        await this.execute({
            name: 'update-desktop-database',
            arguments: [this.getApplicationPath()],
        });
    }

    private async getCommand(entryPath: string): Promise<string | null> {
        if (!await this.fileSystem.exists(entryPath)) {
            return null;
        }

        const content = await this.fileSystem.readTextFile(entryPath);

        if (!/^MimeType=x-scheme-handler\//im.test(content)) {
            return null;
        }

        const match = content.match(/^Exec=(.*)$/im);

        if (match === null) {
            return null;
        }

        return match[1].trim();
    }

    private async findDesktopEntry(protocol: string): Promise<string | null> {
        let output: string | null = null;

        try {
            output = await this.execute({
                name: 'xdg-mime',
                arguments: ['query', 'default', `x-scheme-handler/${protocol}`],
            });
        } catch {
            return null;
        }

        const fileName = output.trim();

        if (fileName === '') {
            return null;
        }

        return this.fileSystem.joinPaths(this.getApplicationPath(), fileName);
    }

    private async execute(command: Command): Promise<string> {
        const execution = this.commandExecutor.run(command);

        if (await execution.wait() !== 0) {
            throw new HelpfulError(`Failed to execute command \`${command.name}\`.`);
        }

        return execution.read();
    }

    private static createDesktopEntry(handler: ProtocolHandler): string {
        const command = handler.command.replace(/\$url/, "'%u'");

        return multiline`
            [Desktop Entry]
            Type=Application
            Name=${handler.name}
            Exec=${LinuxRegistry.COMMAND} "${command}; exec bash"
            StartupNotify=false
            Terminal=true
            MimeType=x-scheme-handler/${handler.protocol}
        `;
    }

    private getDesktopEntryPath(protocol: string): string {
        return this.fileSystem.joinPaths(this.getApplicationPath(), `${protocol}.desktop`);
    }

    private getApplicationPath(): string {
        return this.fileSystem.joinPaths(this.homeDirectory, '.local', 'share', 'applications');
    }
}
