import type {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import type {WorkspaceApi, TargetSdk} from '@/application/api/workspace';
import type {FileSystem} from '@/application/fs/fileSystem';
import {Version} from '@/application/model/version';
import {ErrorReason} from '@/application/error';
import type {
    ContentLoader,
    VersionedContent,
    VersionedContentMap,
} from '@/application/project/sdk/content/contentLoader';
import {ContentError} from '@/application/project/sdk/content/contentLoader';

export type Configuration = {
    workspaceApi: WorkspaceApi,
    fileSystem: FileSystem,
};

/**
 * Loads slot content and typing source from a Croct workspace.
 *
 * Resolves the configured version specifiers against the workspace, caches the
 * fetched content as a `slots.json` file, and reuses it on subsequent loads
 * unless a refresh is requested.
 */
export class WorkspaceContentLoader implements ContentLoader {
    private readonly workspaceApi: WorkspaceApi;

    private readonly fileSystem: FileSystem;

    public constructor(configuration: Configuration) {
        this.workspaceApi = configuration.workspaceApi;
        this.fileSystem = configuration.fileSystem;
    }

    public async downloadContent(configuration: ProjectConfiguration, refresh = false): Promise<void> {
        const filePath = this.getContentPath(configuration);

        if (!refresh && await this.fileSystem.exists(filePath)) {
            return;
        }

        await this.saveContent(await this.fetchContent(configuration), filePath);
    }

    public async loadContent(configuration: ProjectConfiguration, refresh = false): Promise<VersionedContentMap> {
        const filePath = this.getContentPath(configuration);

        if (!refresh && await this.fileSystem.exists(filePath)) {
            return this.readContent(filePath);
        }

        const content = await this.fetchContent(configuration);

        await this.saveContent(content, filePath);

        return content;
    }

    public async loadTypes(configuration: ProjectConfiguration, target: TargetSdk): Promise<string> {
        const {organization, workspace, components, slots} = await this.resolveVersions(configuration);

        return this.workspaceApi.generateTypes({
            organizationSlug: organization,
            workspaceSlug: workspace,
            target: target,
            components: Object.entries(components).map(
                ([component, version]) => ({
                    id: component,
                    version: version,
                }),
            ),
            slots: Object.entries(slots).map(
                ([slot, version]) => ({
                    id: slot,
                    version: version,
                }),
            ),
        });
    }

    private getContentPath(configuration: ProjectConfiguration): string {
        return this.fileSystem.joinPaths(configuration.paths?.content ?? '.', 'slots.json');
    }

    private async saveContent(content: VersionedContentMap, path: string): Promise<void> {
        const directory = this.fileSystem.getDirectoryName(path);

        await this.fileSystem.createDirectory(directory, {recursive: true});

        await this.fileSystem.writeTextFile(
            path,
            JSON.stringify(content, null, 2),
            {overwrite: true},
        );
    }

    private async readContent(path: string): Promise<VersionedContentMap> {
        let content: string;

        try {
            content = await this.fileSystem.readTextFile(path);
        } catch {
            return {};
        }

        try {
            return JSON.parse(content);
        } catch (error) {
            throw new ContentError('Failed to parse content file.', {
                reason: ErrorReason.INVALID_INPUT,
                cause: error,
                details: [`File: ${path}`],
            });
        }
    }

    private async fetchContent(configuration: ProjectConfiguration): Promise<VersionedContentMap> {
        const resolved = await this.resolveVersions(configuration);

        const slots = Object.entries(resolved.slots);
        const slotVersions: Record<string, readonly number[]> = {};

        for (const [slot, versionSpecifier] of slots) {
            slotVersions[slot] = Version.parse(versionSpecifier).getVersions();
        }

        return Object.fromEntries(
            await Promise.all(
                slots.map(
                    async ([slot]) => [
                        slot,
                        await Promise.all(
                            slotVersions[slot].map(
                                version => this.workspaceApi
                                    .getSlotStaticContent(
                                        {
                                            organizationSlug: resolved.organization,
                                            workspaceSlug: resolved.workspace,
                                            slotSlug: slot,
                                        },
                                        version,
                                    )
                                    .then(
                                        (versionedContent): VersionedContent => ({
                                            version: version,
                                            content: Object.fromEntries(
                                                versionedContent.map(({locale, content}) => [locale, content]),
                                            ),
                                        }),
                                    ),
                            ),
                        ),
                    ] as const,
                ),
            ),
        );
    }

    private async resolveVersions(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        const listedComponents = Object.keys(configuration.components);
        const listedSlots = Object.keys(configuration.slots);

        if (listedComponents.length === 0 && listedSlots.length === 0) {
            return configuration;
        }

        const [slots, components] = await Promise.all([
            Promise.all(listedSlots.map(
                slot => (
                    this.workspaceApi.getSlot({
                        organizationSlug: configuration.organization,
                        workspaceSlug: configuration.workspace,
                        slotSlug: slot,
                    })
                ),
            )).then(list => list.filter(slot => slot !== null)),
            Promise.all(listedComponents.map(
                component => (
                    this.workspaceApi.getComponent({
                        organizationSlug: configuration.organization,
                        workspaceSlug: configuration.workspace,
                        componentSlug: component,
                    })
                ),
            )).then(list => list.filter(component => component !== null)),
        ]);

        return {
            ...configuration,
            components: Object.fromEntries(
                Object.entries(configuration.components).flatMap<[string, string]>(([slug, version]) => {
                    const versions = Version.parse(version)
                        .getVersions()
                        .filter(
                            major => components.some(
                                component => component.slug === slug
                                    && major <= component.version.major,
                            ),
                        );

                    if (versions.length === 0) {
                        return [];
                    }

                    return [[slug, Version.either(...versions).toString()]];
                }),
            ),
            slots: Object.fromEntries(
                Object.entries(configuration.slots).flatMap<[string, string]>(([slug, version]) => {
                    const versions = Version.parse(version)
                        .getVersions()
                        .filter(
                            major => slots.some(
                                slot => slot.slug === slug
                                    && major <= slot.version.major,
                            ),
                        );

                    if (versions.length === 0) {
                        return [];
                    }

                    return [[slug, Version.either(...versions).toString()]];
                }),
            ),
        };
    }
}
