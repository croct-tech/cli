import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {Sdk} from '@/application/project/sdk/sdk';

export type InstallInput = {
    update?: boolean,
};

export type InstallConfig = {
    sdk: Sdk,
    configurationManager: ConfigurationManager,
    io: {
        input?: Input,
        output: Output,
    },
};

export class InstallCommand implements Command<InstallInput> {
    private readonly configuration: InstallConfig;

    public constructor(config: InstallConfig) {
        this.configuration = config;
    }

    public async execute(input: InstallInput): Promise<void> {
        const {sdk, configurationManager, io} = this.configuration;
        const configuration = await configurationManager.load();

        await sdk.update(
            {
                input: io.input,
                output: io.output,
                configuration: configuration,
            },
            {
                clean: input.update === true,
            },
        );
    }
}
