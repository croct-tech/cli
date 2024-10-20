export interface Linter {
    fix(files: string[]): Promise<void>;
}
