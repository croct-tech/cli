export type SourcePosition = {
    readonly index: number,
    readonly line: number,
    readonly column: number,
};

export namespace SourcePosition {
    export function unknown(): SourcePosition {
        return {
            index: -1,
            line: 0,
            column: 0,
        };
    }
}

export type SourceLocation = {
    readonly start: SourcePosition,
    readonly end: SourcePosition,
};

export namespace SourceLocation {
    export function unknown(): SourceLocation {
        return {
            start: SourcePosition.unknown(),
            end: SourcePosition.unknown(),
        };
    }
}
