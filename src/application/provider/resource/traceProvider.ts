import {LogLevel} from '@croct/logging';
import {Resource, ResourceProvider} from '@/application/provider/resource/resourceProvider';
import {HierarchicalLogger} from '@/application/logging/hierarchicalLogger';
import {HelpfulError} from '@/application/error';

export type Configuration<T> = {
    label?: string,
    provider: ResourceProvider<T>,
    logger: HierarchicalLogger,
};

export class TraceProvider<T> implements ResourceProvider<T> {
    private readonly provider: ResourceProvider<T>;

    private readonly logger: HierarchicalLogger;

    private readonly label?: string;

    public constructor({provider, logger, label}: Configuration<T>) {
        this.provider = provider;
        this.logger = logger;
        this.label = label;
    }

    public get(url: URL): Promise<Resource<T>> {
        return this.logger.nest(
            {
                message: `\`${this.label ?? this.provider.constructor.name}\``,
                level: LogLevel.DEBUG,
            },
            () => this.trace(url),
        );
    }

    private async trace(url: URL): Promise<Resource<T>> {
        this.logger.log({
            message: `URL: ${url}`,
            level: LogLevel.DEBUG,
        });

        try {
            const result = await this.provider.get(url);

            this.logger.log({
                message: 'No errors',
                level: LogLevel.DEBUG,
            });

            return result;
        } catch (error) {
            this.logger.log({
                message: `Error: ${HelpfulError.formatMessage(error)}`,
                level: LogLevel.DEBUG,
            });

            throw error;
        }
    }
}
