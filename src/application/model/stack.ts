type TechnologyMap = {
    next: {
        router: 'app' | 'page',
        sourcePath: string,
        defaultLocale?: string,
        locales?: string[],
    },
    react: {
        sourcePath: string,
    },
    typescript: {
        importAlias?: string,
    },
};

export type TechnologyName = keyof TechnologyMap;

export type Technology<T extends TechnologyName = TechnologyName> = {
    [N in T]: TechnologyMap[N] & {
        name: N,
        version: string|null,
    };
}[T];
