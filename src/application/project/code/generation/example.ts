export enum CodeLanguage {
    HTML = 'html',
    JAVASCRIPT = 'javascript',
    JAVASCRIPT_XML = 'jsx',
    TYPESCRIPT = 'typescript',
    TYPESCRIPT_XML = 'tsx',
}

export namespace CodeLanguage {
    const EXTENSIONS: Record<CodeLanguage, string> = {
        [CodeLanguage.HTML]: 'html',
        [CodeLanguage.JAVASCRIPT]: 'js',
        [CodeLanguage.JAVASCRIPT_XML]: 'jsx',
        [CodeLanguage.TYPESCRIPT]: 'ts',
        [CodeLanguage.TYPESCRIPT_XML]: 'tsx',
    };

    export function getExtension(language: CodeLanguage): string {
        return EXTENSIONS[language];
    }
}

export type ExampleFile = {
    name: string,
    language: CodeLanguage,
    code: string,
};

export type CodeExample = {
    files: ExampleFile[],
};

export interface ExampleGenerator<T> {
    generate(definition: T): CodeExample;
}
