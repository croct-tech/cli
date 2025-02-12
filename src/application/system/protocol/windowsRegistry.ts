import {ProtocolHandler, ProtocolRegistry, ProtocolRegistryError} from '@/application/system/protocol/protocolRegistry';
import {CommandExecutor} from '@/application/system/process/executor';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Command} from '@/application/system/process/command';

export type Configuration = {
    commandExecutor: CommandExecutor,
};

export class WindowsRegistry implements ProtocolRegistry {
    private readonly commandExecutor: CommandExecutor;

    public constructor({commandExecutor}: Configuration) {
        this.commandExecutor = commandExecutor;
    }

    public async isRegistered(protocol: string): Promise<boolean> {
        return (await this.findCommand(protocol)) !== null;
    }

    public async register(handler: ProtocolHandler): Promise<void> {
        if (await this.isRegistered(handler.protocol)) {
            throw new ProtocolRegistryError(`Protocol \`${handler.protocol}\` is already registered.`, {
                reason: ErrorReason.PRECONDITION,
            });
        }

        try {
            await this.install(handler);
        } catch (error) {
            throw new ProtocolRegistryError('Failed to register protocol handler', {
                cause: error,
            });
        }
    }

    private async install(handler: ProtocolHandler): Promise<void> {
        const registryPath = WindowsRegistry.getRegistryPath(handler.protocol);
        const commandRegistryPath = WindowsRegistry.getCommandRegistryPath(handler.protocol);
        const command = WindowsRegistry.getCommand(handler.command);

        await this.execute({
            name: 'REG',
            arguments: ['add', registryPath, '/f'],
        });

        await this.execute({
            name: 'REG',
            arguments: ['add', registryPath, '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f'],
        });

        await this.execute({
            name: 'REG',
            arguments: ['add', registryPath, '/ve', '/t', 'REG_SZ', '/d', `URL:${handler.protocol}`, '/f'],
        });

        await this.execute({
            name: 'REG',
            arguments: ['add', commandRegistryPath, '/ve', '/t', 'REG_SZ', '/d', command, '/f'],
        });
    }

    public async unregister(protocol: string): Promise<void> {
        const command = await this.findCommand(protocol);

        if (command === null) {
            return;
        }

        if (!command.startsWith(WindowsRegistry.getCommand(''))) {
            throw new ProtocolRegistryError(
                `Application registered for protocol \`${protocol}\` is externally managed.`,
                {
                    reason: ErrorReason.PRECONDITION,
                },
            );
        }

        try {
            await this.execute({
                name: 'REG',
                arguments: ['DELETE', `${WindowsRegistry.getRegistryPath(protocol)}`, '/f'],
            });
        } catch (error) {
            throw new ProtocolRegistryError('Failed to unregister protocol handler', {
                cause: error,
            });
        }
    }

    private async execute(command: Command): Promise<string> {
        const execution = this.commandExecutor.run(command);
        const result = await execution.wait();

        if (result !== 0) {
            throw new HelpfulError(`Failed to execute command \`${command.name}\`.`);
        }

        let output = '';

        for await (const chunk of execution.output) {
            output += chunk;
        }

        return output;
    }

    private async findCommand(protocol: string): Promise<string | null> {
        const entry = await this.execute({
            name: 'REG',
            arguments: ['query', `${WindowsRegistry.getCommandRegistryPath(protocol)}`, '/ve'],
        }).catch(() => null);

        if (entry === null) {
            return null;
        }

        const match = /REG_SZ\s+(.*)/g.exec(entry);

        if (match === null) {
            return null;
        }

        return match[1].trim();
    }

    private static getCommand(command: string): string {
        return `PowerShell -NoExit -Command ${command.replace(/\$url/, '"%1"')}`;
    }

    private static getCommandRegistryPath(protocol: string): string {
        return WindowsRegistry.getRegistryPath(protocol, 'shell\\open\\command');
    }

    private static getRegistryPath(protocol: string, key?: string): string {
        return `HKCU\\Software\\Classes\\${protocol}${key !== undefined ? `\\${key}` : ''}`;
    }
}
