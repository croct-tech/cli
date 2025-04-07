import {ErrorReason, Help, HelpfulError} from '@/application/error';

export type ProjectPaths = {
    source: string,
    utilities: string,
    components: string,
    examples: string,
    content?: string,
};

export type ProjectConfiguration = {
    organization: string,
    workspace: string,
    applications: {
        development: string,
        production?: string,
    },
    defaultLocale: string,
    locales: string[],
    slots: Record<string, string>,
    components: Record<string, string>,
    paths?: Partial<ProjectPaths>,
};

export class ProjectConfigurationError extends HelpfulError {
    public constructor(message: string, help: Help = {}) {
        super(message, {
            ...help,
            reason: help.reason ?? ErrorReason.INVALID_CONFIGURATION,
        });

        Object.setPrototypeOf(this, ProjectConfigurationError.prototype);
    }
}
