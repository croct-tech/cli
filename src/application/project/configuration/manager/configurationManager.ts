import {Configuration, ResolvedConfiguration} from '@/application/project/configuration/configuration';

export interface ConfigurationManager {
    load(): Promise<Configuration | null>;

    resolve(): Promise<ResolvedConfiguration>;

    update(configuration: Configuration): Promise<Configuration>;
}
