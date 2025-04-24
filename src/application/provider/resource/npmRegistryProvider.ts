import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {ErrorReason} from '@/application/error';
import {Mapping} from '@/application/provider/resource/mappedProvider';

export type PackageMetadata = {
    name: string,
    repository: {
        type: string,
        url: string,
    },
};

export class NpmRegistryProvider implements ResourceProvider<Mapping[]> {
    private static readonly REPOSITORY_PATTERNS = [
        /git\+(https:\/\/.+)\.git$/,
    ];

    private readonly metadataProvider: ResourceProvider<PackageMetadata>;

    public constructor(metadataProvider: ResourceProvider<PackageMetadata>) {
        this.metadataProvider = metadataProvider;
    }

    public async get(url: URL): Promise<Resource<Mapping[]>> {
        const metadataUrl = this.getMetadataUrl(url);

        if (metadataUrl === null) {
            throw new ResourceProviderError('Unsupported NPM URL.', {
                reason: ErrorReason.NOT_SUPPORTED,
                url: url,
            });
        }

        const {value: metadata} = await this.metadataProvider.get(metadataUrl);

        const repositoryUrl = NpmRegistryProvider.getRepositoryUrl(metadata.repository);

        if (repositoryUrl === null) {
            return {
                url: url,
                value: [],
            };
        }

        return {
            url: repositoryUrl,
            value: [{
                pattern: '.*',
                destination: repositoryUrl,
            }],
        };
    }

    private static getRepositoryUrl(metadata: PackageMetadata['repository']): URL|null {
        for (const pattern of NpmRegistryProvider.REPOSITORY_PATTERNS) {
            const match = pattern.exec(metadata.url);

            if (match !== null) {
                return new URL(`${match[1]}/`);
            }
        }

        return null;
    }

    private getMetadataUrl(url: URL): URL|null {
        if (url.protocol !== 'npm:') {
            return null;
        }

        const name = decodeURIComponent(url.hostname) + url.pathname;

        return new URL(`https://registry.npmjs.org/${name}/latest`);
    }
}
