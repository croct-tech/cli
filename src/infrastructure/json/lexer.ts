import {JsonToken, JsonTokenType} from './token';
import {SourcePosition} from './location';

type TokenPattern = {
    type: JsonTokenType,
    pattern: RegExp|string,
};

export class JsonLexer implements Iterable<JsonToken> {
    // Sorted by precedence
    private static PATTERNS: TokenPattern[] = [
        {
            type: JsonTokenType.BRACE_LEFT,
            pattern: '{',
        },
        {
            type: JsonTokenType.BRACE_RIGHT,
            pattern: '}',
        },
        {
            type: JsonTokenType.BRACKET_LEFT,
            pattern: '[',
        },
        {
            type: JsonTokenType.BRACKET_RIGHT,
            pattern: ']',
        },
        {
            type: JsonTokenType.STRING,
            pattern: /^"(?:[^"\\]|\\.)*"/,
        },
        {
            type: JsonTokenType.NUMBER,
            pattern: /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
        },
        {
            type: JsonTokenType.BOOLEAN,
            pattern: /^(true|false)/,
        },
        {
            type: JsonTokenType.NULL,
            pattern: 'null',
        },
        {
            type: JsonTokenType.COLON,
            pattern: ':',
        },
        {
            type: JsonTokenType.COMMA,
            pattern: ',',
        },
        {
            type: JsonTokenType.NEWLINE,
            pattern: /^(\r?\n)+/,
        },
        {
            type: JsonTokenType.WHITESPACE,
            pattern: /^[ \t\f\r]+/,
        },
    ];

    private remaining: string;

    private current: JsonToken|null = null;

    public constructor(source: string) {
        this.remaining = source;
    }

    public static tokenize(source: string): JsonToken[] {
        return [...new JsonLexer(source)];
    }

    public isEof(): boolean {
        return this.current?.type === JsonTokenType.EOF;
    }

    public [Symbol.iterator](): Iterator<JsonToken> {
        return {
            next: () => (
                this.isEof()
                    ? {
                        done: true,
                        value: undefined,
                    }
                    : {
                        done: false,
                        value: this.next(),
                    }
            ),
        };
    }

    public skipSpace(): JsonToken[] {
        return this.skip(JsonTokenType.WHITESPACE, JsonTokenType.NEWLINE);
    }

    public skip(...types: JsonTokenType[]): JsonToken[] {
        const tokens: JsonToken[] = [];

        while (!this.isEof() && this.matches(...types)) {
            tokens.push(this.peek());
            this.next();
        }

        return tokens;
    }

    public expect<T extends JsonTokenType>(...types: T[]): JsonToken<T> {
        const token = this.peek();

        if (!JsonLexer.isTokenType(token, types)) {
            const {line, column} = token.location.start;
            const expectedTypes = types.length === 1
                ? types[0]
                : `either ${types.slice(0, -1).join(', ')} or ${types[types.length - 1]}`;

            throw new Error(`Expected ${expectedTypes} at ${line}:${column}, but got ${token.type}.`);
        }

        return token;
    }

    public consume<T extends JsonTokenType>(...types: T[]): JsonToken<T> {
        const token = this.expect(...types);

        if (!this.isEof()) {
            this.next();
        }

        return token;
    }

    public matches(...types: JsonTokenType[]): boolean {
        return JsonLexer.isTokenType(this.peek(), types);
    }

    public peek(): JsonToken {
        if (this.current === null) {
            throw new Error('No token has been consumed yet.');
        }

        return this.current;
    }

    public next(): JsonToken {
        if (this.remaining === '') {
            this.current = this.createToken(JsonTokenType.EOF, '');
        } else {
            this.current = this.match();
            this.remaining = this.remaining.slice(this.current.value.length);
        }

        return this.current;
    }

    private match(): JsonToken {
        if (this.isEof()) {
            throw new Error('The end of the input has been reached');
        }

        for (const {type, pattern} of JsonLexer.PATTERNS) {
            if (typeof pattern === 'string') {
                if (this.remaining.startsWith(pattern)) {
                    return this.createToken(type, pattern);
                }

                continue;
            }

            const match = this.remaining.match(pattern);

            if (match !== null) {
                return this.createToken(type, match[0]);
            }
        }

        const line = this.current?.location.end.line ?? 1;
        const column = this.current?.location.end.column ?? 1;
        const char = this.remaining[0];

        throw new Error(`Unexpected token '${char}' at ${line}:${column}.`);
    }

    private createToken(type: JsonTokenType, value: string): JsonToken {
        const start: SourcePosition = {
            index: this.current?.location.end.index ?? 0,
            line: this.current?.location.end.line ?? 1,
            column: this.current?.location.end.column ?? 1,
        };

        const end = {
            index: start.index,
            line: start.line,
            column: start.column,
        } satisfies SourcePosition;

        end.index += value.length;

        if (type === JsonTokenType.NEWLINE) {
            end.column = 1;
            end.line++;
        } else {
            end.column += value.length;
        }

        return {
            type: type,
            value: value,
            location: {
                start: start,
                end: end,
            },
        };
    }

    private static isTokenType<T extends JsonTokenType>(token: JsonToken, types: T[]): token is JsonToken<T> {
        return types.includes(token.type as T);
    }
}
