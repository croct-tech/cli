import {Command} from '@/application/cli/command/command';
import {ProtocolHandler, ProtocolRegistry} from '@/application/system/protocol/protocolRegistry';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Provider} from '@/application/provider/provider';
import {PackageManager} from '@/application/project/packageManager/packageManager';
import {CliConfigurationProvider} from '@/application/cli/configuration/provider';
import {HelpfulError} from '@/application/error';

export type WelcomeInput = Record<string, never>;

export type WelcomeConfig = {
    version: string,
    packageManager: PackageManager,
    protocolRegistryProvider: Provider<ProtocolRegistry|null>,
    configurationProvider: CliConfigurationProvider,
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
        const {output} = this.config.io;

        try {
            await this.enableDeepLinks();
        } catch (error) {
            output.alert(`Failed to enable deep links: ${HelpfulError.formatCause(error)}`);
        }
    }

    private async enableDeepLinks(): Promise<void> {
        const {
            packageManager,
            protocolRegistryProvider,
            protocolHandler,
            configurationProvider,
            version,
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

        if (!isPackageManagerInstalled) {
            return;
        }

        if (isRegistered) {
            const configuration = await configurationProvider.get();

            if (configuration.version !== version) {
                // The CLI has been updated, re-register the protocol handler to ensure
                // any changes are applied
                await registry.unregister(protocolHandler.protocol);

                const notifier = output.notify('Updating deep links...');

                try {
                    await this.installDeepLinks(registry);

                    output.confirm('Deep links updated');
                } finally {
                    notifier.stop();
                }

                await configurationProvider.save({
                    ...configuration,
                    version: version,
                });
            }

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
            await this.installDeepLinks(registry);

            output.confirm('Deep links enabled');
        } finally {
            notifier.stop();
        }
    }

    private async installDeepLinks(registry: ProtocolRegistry): Promise<void> {
        const {cliPackage, packageManager, protocolHandler} = this.config;

        const command = await packageManager.getPackageCommand(cliPackage, ['open', '$url']);

        return registry.register({
            ...protocolHandler,
            command: `${command.name} ${(command.arguments ?? []).join(' ')}`,
        });
    }
}
