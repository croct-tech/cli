import {Provider} from '@/application/provider/provider';

export type CliConfiguration = {
    projectPaths: string[],
    isDeepLinkingEnabled?: boolean,
};

export interface CliConfigurationProvider extends Provider<CliConfiguration> {
    get(): Promise<CliConfiguration>;

    save(settings: CliConfiguration): Promise<void>;
}
