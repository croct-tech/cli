export type ProjectConfiguration = {
    organization: string,
    workspace: string,
    applications: {
        development: string,
        production: string,
    },
    locales: string[],
    slots: Record<string, string>,
    components: Record<string, string>,
};

export interface ProjectConfigurationFile {
    exists(): Promise<boolean>;

    load(): Promise<ProjectConfiguration | null>;

    update(configuration: ProjectConfiguration): Promise<void>;
}
