export type NodeImportConfig = {
    rootConfigPath: string,
    matchedConfigPath: string,
    baseUrl: string,
    paths: Record<string, string[]>,
};

export type Options = {
    fileNames?: string[],
    sourcePaths?: string[],
};

export interface TsConfigLoader {
    load(directory: string, options?: Options): Promise<NodeImportConfig | null>;
}
