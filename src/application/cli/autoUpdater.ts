import semver from 'semver';
import isInstalledGlobally from 'is-installed-globally';
import {PackageManager} from '@/application/project/packageManager/packageManager';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {CliConfiguration, CliConfigurationProvider} from '@/application/cli/configuration/provider';

export type Configuration = {
    currentVersion: string,
    packageManager: PackageManager,
    configurationProvider: CliConfigurationProvider,
    input?: Input,
    output: Output,
    checkTimeout: number,
    checkFrequency: number,
};

export class AutoUpdater {
    private readonly currentVersion: string;

    private readonly packageManager: PackageManager;

    private readonly configurationProvider: CliConfigurationProvider;

    private readonly input?: Input;

    private readonly output: Output;

    private readonly checkTimeout: number;

    private readonly checkFrequency: number;

    public constructor(config: Configuration) {
        this.currentVersion = config.currentVersion;
        this.packageManager = config.packageManager;
        this.configurationProvider = config.configurationProvider;
        this.input = config.input;
        this.output = config.output;
        this.checkTimeout = config.checkTimeout;
        this.checkFrequency = config.checkFrequency;
    }

    public async checkForUpdates(): Promise<void> {
        const configuration = await this.configurationProvider.get();

        if (!this.isCheckEnabled(configuration)) {
            return;
        }

        const latestVersion = await this.getLatestVersion();

        if (latestVersion === null) {
            return;
        }

        await this.configurationProvider.save({
            ...configuration,
            lastUpdateCheck: Date.now(),
        });

        if (semver.gte(this.currentVersion, latestVersion)) {
            return;
        }

        this.output.announce({
            semantics: 'info',
            title: 'New version',
            message: `Update your CLI from ~~${this.currentVersion}~~ → \`${latestVersion}\``,
        });

        const update = (await this.input?.confirm({
            message: 'Would you like to update now?',
            default: true,
        })) ?? false;

        if (!update) {
            return;
        }

        try {
            await this.packageManager.updatePackage('croct', isInstalledGlobally);
        } catch (error) {
            const updateCommand = await this.packageManager.getPackageUpdateCommand('croct', isInstalledGlobally);
            const fullCommand = `${updateCommand.name} ${updateCommand.arguments?.join(' ')}`;

            this.output.alert('Failed to update the Croct CLI automatically');
            this.output.log(`Please run the command:\n\`${fullCommand}\``);

            return;
        }

        this.output.confirm('CLI updated successfully!');
        this.output.inform('The new version will take effect the next time you run a command');
    }

    private isCheckEnabled(configuration: CliConfiguration): boolean {
        return configuration.lastUpdateCheck === undefined
            || (Date.now() - configuration.lastUpdateCheck) > this.checkFrequency;
    }

    private getLatestVersion(): Promise<string | null> {
        const abortController = new AbortController();

        setTimeout(() => abortController.abort(), this.checkTimeout);

        return fetch('https://registry.npmjs.org/croct/latest', {signal: abortController.signal})
            .then(response => response.json() as Promise<{version: string}>)
            .then(data => data.version)
            .catch(() => null);
    }
}
