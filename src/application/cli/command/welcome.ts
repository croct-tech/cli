import {Command} from '@/application/cli/command/command';
import {ProtocolHandler, ProtocolRegistry} from '@/application/system/protocol/protocolRegistry';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Provider} from '@/application/provider/provider';
import {PackageManager} from '@/application/project/packageManager/packageManager';

export type WelcomeInput = Record<string, never>;

export type WelcomeConfig = {
    packageManager: PackageManager,
    protocolRegistryProvider: Provider<ProtocolRegistry|null>,
    cliPackage: string,
    protocolHandler: Omit<ProtocolHandler, 'command'>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class WelcomeCommand implements Command<WelcomeInput> {
    private readonly config: WelcomeConfig;

    public constructor(config: WelcomeConfig) {
        this.config = config;
    }

    public async execute(): Promise<void> {
        try {
            await this.enableDeepLinks();
        } catch {
            // suppress
        }
    }

    private async enableDeepLinks(): Promise<void> {
        const {
            cliPackage,
            packageManager,
            protocolRegistryProvider,
            protocolHandler,
            io: {output, input},
        } = this.config;

        const registry = await protocolRegistryProvider.get();

        if (registry === null || input === undefined) {
            return;
        }

        const [isRegistered, isPackageManagerInstalled] = await Promise.all([
            registry.isRegistered(protocolHandler.protocol),
            packageManager.isInstalled(),
        ]);

        await registry.unregister('croct');

        if (isRegistered || !isPackageManagerInstalled) {
            return;
        }

        if (
            !await input.confirm({
                message: 'Turn on deep links to streamline your experience?',
                default: true,
            })
        ) {
            return;
        }

        const notifier = output.notify('Enabling deep links...');

        try {
            const command = await packageManager.getPackageCommand(cliPackage, ['open', '$url']);

            await registry.register({
                ...protocolHandler,
                command: `${command.name} ${(command.arguments ?? []).join(' ')}`,
            });

            output.confirm('Deep links enabled');
        } finally {
            notifier.stop();
        }
    }
}
