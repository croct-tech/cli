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
