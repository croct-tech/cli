import {RootDefinition as ContentDefinition} from '@croct/content-model/definition/definition';

declare global {
    namespace ContentModel {
        type RootDefinition = ContentDefinition;
    }
}

declare module '@babel/types' {
    type Token = {
        type: string,
        value: string,
        start: number,
        end: number,
        loc: SourceLocation,
        leading: boolean,
        trailing: boolean,
    };

    export interface SourceLocation {
        tokens?: Token[];
    }

    export interface Noop {
        comments?: Comment[];
    }
}

export {};
