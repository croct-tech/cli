import {Command} from '@/application/cli/command/command';
import {ProtocolHandler, ProtocolRegistry} from '@/application/system/protocol/protocolRegistry';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Provider} from '@/application/provider/provider';
import {PackageManager} from '@/application/project/packageManager/packageManager';
import {CliConfigurationProvider} from '@/application/cli/configuration/provider';
import {HelpfulError} from '@/application/error';

type Operation = 'enable' | 'disable' | 'optionally-enable' | 'optionally-update';

export type DeepLinkInput = {
    operation: Operation,
};

export type DeepLinkConfig = {
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

export class DeepLinkCommand implements Command<DeepLinkInput> {
    private readonly config: DeepLinkConfig;

    public constructor(config: DeepLinkConfig) {
        this.config = config;
    }

    public async execute(input: DeepLinkInput): Promise<void> {
        const {protocolRegistryProvider, io: {output}} = this.config;

        const registry = await protocolRegistryProvider.get();

        if (registry === null) {
            if (!['optionally-enable', 'optionally-update'].includes(input.operation)) {
                output.alert('Deep linking is not available on your platform.');
            }

            return;
        }

        try {
            await this.apply(registry, input);
        } catch (error) {
            output.alert(`Deep link error: ${HelpfulError.formatCause(error)}`);
        }
    }

    private apply(registry: ProtocolRegistry, options: DeepLinkInput): Promise<void> {
        const {io: {output}} = this.config;

        switch (options.operation) {
            case 'optionally-enable':
                return this.optionallyEnable(registry, output);

            case 'optionally-update':
                return this.optionallyUpdate(registry, output);

            case 'disable':
                return this.disable(registry, false, output);

            case 'enable':
                return this.enable(registry, false, output);
        }
    }

    private async optionallyEnable(registry: ProtocolRegistry, output?: Output): Promise<void> {
        const {protocolHandler, io: {input}} = this.config;

        if (
            !await registry.isRegistered(protocolHandler.protocol)
            && (await input?.confirm({
                message: 'Turn on deep links to streamline your experience?',
                default: false,
            })) === true
        ) {
            return this.enable(registry, true, output);
        }
    }

    private async enable(registry: ProtocolRegistry, skipCheck: boolean, output?: Output): Promise<void> {
        const {cliPackage, packageManager, protocolHandler} = this.config;

        if (!skipCheck && await registry.isRegistered(protocolHandler.protocol)) {
            output?.inform('Deep links are already enabled');

            return;
        }

        const notifier = output?.notify('Enabling deep links');

        try {
            const command = await packageManager.getPackageCommand(cliPackage, ['open', '$url']);

            await registry.register({
                ...protocolHandler,
                command: `${command.name} ${(command.arguments ?? []).join(' ')}`,
            });

            notifier?.confirm('Deep links enabled');
        } finally {
            notifier?.stop();
        }
    }

    private async disable(registry: ProtocolRegistry, skipCheck: boolean, output?: Output): Promise<void> {
        const {protocolHandler} = this.config;

        if (!skipCheck && !await registry.isRegistered(protocolHandler.protocol)) {
            output?.inform('Deep links are not enabled');

            return;
        }

        const notifier = output?.notify('Disabling deep links');

        try {
            await registry.unregister(protocolHandler.protocol);

            notifier?.confirm('Deep links disabled');
        } finally {
            notifier?.stop();
        }
    }

    private async optionallyUpdate(registry: ProtocolRegistry, output?: Output): Promise<void> {
        const {protocolHandler} = this.config;

        if (!await registry.isRegistered(protocolHandler.protocol)) {
            return this.optionallyEnable(registry, output);
        }

        const notifier = output?.notify('Updating deep links');

        try {
            await this.disable(registry, true);
            await this.enable(registry, true);

            notifier?.confirm('Deep links updated');
        } finally {
            notifier?.stop();
        }
    }
}
