import type {Help} from '@/application/error';
import {HelpfulError} from '@/application/error';
import type {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import type {LocalizedContentMap} from '@/application/model/experience';
import type {TargetSdk} from '@/application/api/workspace';

export type VersionedContent = {
    version: number,
    content: LocalizedContentMap,
};

export type VersionedContentMap = Record<string, VersionedContent[]>;

export class ContentError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, ContentError.prototype);
    }
}

export interface ContentLoader {
    /**
     * Downloads the slot content from the workspace and caches it.
     *
     * Keeps the cached content when it already exists, unless `refresh` is true, in
     * which case it always fetches the content from the workspace and updates the cache.
     *
     * @throws ContentError If the content cannot be downloaded.
     */
    downloadContent(configuration: ProjectConfiguration, refresh?: boolean): Promise<void>;

    /**
     * Gets the slot content for the project, downloading it first when necessary.
     *
     * @throws ContentError If the content cannot be downloaded or read.
     */
    loadContent(configuration: ProjectConfiguration, refresh?: boolean): Promise<VersionedContentMap>;

    /**
     * Gets the typing source for the given target SDK from the workspace.
     */
    loadTypes(configuration: ProjectConfiguration, target: TargetSdk): Promise<string>;
}
