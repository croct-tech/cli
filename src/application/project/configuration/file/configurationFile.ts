import {Configuration} from '@/application/project/configuration/configuration';

export interface ConfigurationFile {
    load(): Promise<Configuration | null>;

    update(configuration: Configuration): Promise<void>;
}
