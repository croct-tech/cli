import {Command} from '@/application/cli/command/command';
import {CliConfigurationProvider} from '@/application/cli/configuration/provider';
import {AutoUpdater} from '@/application/cli/autoUpdater';

export type WelcomeInput = {
    skipDeepLinkCheck?: boolean,
    skipUpdateCheck?: boolean,
};

export type DeepLinkInstaller = (update: boolean) => Promise<void>;

export type WelcomeConfig = {
    cliVersion: string,
    deepLinkInstaller: DeepLinkInstaller,
    autoUpdater: AutoUpdater,
    configurationProvider: CliConfigurationProvider,
};

export class WelcomeCommand implements Command<WelcomeInput> {
    private readonly cliVersion: string;

    private readonly autoUpdater: AutoUpdater;

    private readonly deepLinkInstaller: DeepLinkInstaller;

    private readonly configurationProvider: CliConfigurationProvider;

    public constructor(config: WelcomeConfig) {
        this.cliVersion = config.cliVersion;
        this.autoUpdater = config.autoUpdater;
        this.deepLinkInstaller = config.deepLinkInstaller;
        this.configurationProvider = config.configurationProvider;
    }

    public async execute(input: WelcomeInput): Promise<void> {
        const configuration = await this.configurationProvider.get();
        const installedVersion = configuration.version;

        if (installedVersion !== this.cliVersion) {
            // Keep track of the previously installed version
            await this.configurationProvider.save({
                ...configuration,
                version: this.cliVersion,
            });
        }

        if (input.skipUpdateCheck !== true) {
            await this.autoUpdater.checkForUpdates();
        }

        if (input.skipDeepLinkCheck !== true) {
            await this.deepLinkInstaller(installedVersion !== this.cliVersion);
        }
    }
}
