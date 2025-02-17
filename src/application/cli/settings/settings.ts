export type CliSettings = {
    projectPaths: string[],
    isDeepLinkingEnabled?: boolean,
};

export interface CliSettingsStore {
    getSettings(): Promise<CliSettings>;

    saveSettings(settings: CliSettings): Promise<void>;
}
