export interface ProjectIndex {
    getPaths(): Promise<string[]>;
    addPath(path: string): Promise<void>;
}
