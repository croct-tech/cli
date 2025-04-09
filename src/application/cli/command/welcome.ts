import {Command} from '@/application/cli/command/command';
import {CliConfigurationProvider} from '@/application/cli/configuration/provider';

export type WelcomeInput = {
    skipDeepLinkCheck?: boolean,
};

export type DeepLinkInstaller = (update: boolean) => Promise<void>;

export type WelcomeConfig = {
    version: string,
    configurationProvider: CliConfigurationProvider,
    deepLinkInstaller: DeepLinkInstaller,
};

export class WelcomeCommand implements Command<WelcomeInput> {
    private readonly config: WelcomeConfig;

    public constructor(config: WelcomeConfig) {
        this.config = config;
    }

    public async execute(input: WelcomeInput): Promise<void> {
        if (input.skipDeepLinkCheck !== true) {
            await this.setupDeepLinks();
        }
    }

    private async setupDeepLinks(): Promise<void> {
        const {configurationProvider, version, deepLinkInstaller} = this.config;

        const configuration = await configurationProvider.get();
        const installedVersion = configuration.version;

        if (installedVersion !== version) {
            // Keep track of the previously installed version
            await configurationProvider.save({
                ...configuration,
                version: version,
            });
        }

        await deepLinkInstaller(installedVersion !== version);
    }
}
