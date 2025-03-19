export enum CodeLanguage {
    HTML = 'html',
    JAVASCRIPT = 'javascript',
    JAVASCRIPT_XML = 'jsx',
    TYPESCRIPT = 'typescript',
    TYPESCRIPT_XML = 'tsx',
}

export type ExampleFile = {
    path: string,
    language: CodeLanguage,
    code: string,
};

export type CodeExample = {
    files: ExampleFile[],
};

export interface ExampleGenerator<T> {
    generate(definition: T): CodeExample;
}
