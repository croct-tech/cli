import {
    JsonIdentifierNode,
    JsonPrimitiveNode,
    JsonStringNode,
    SourceLocation,
    SourcePosition,
} from '@/infrastructure/json';
import {HelpfulError} from '@/application/error';

type FragmentMap = {
    expression: {
        expression: string,
    },
    literal: Record<never, never>,
};

export type Fragment<T extends keyof FragmentMap = keyof FragmentMap> = {
    [K in T]: FragmentMap[K] & {
        type: K,
        source: string,
        location: SourceLocation,
    }
}[T];

export type JsonExpressionNode = JsonStringNode|JsonIdentifierNode;

export class TemplateStringParser implements Iterator<Fragment>, Iterable<Fragment> {
    private readonly chars: string[];

    private cursor = 0;

    private index;

    private line;

    private column;

    private constructor(value: string, position: SourcePosition) {
        this.chars = [...value];
        this.index = position.index;
        this.line = position.line;
        this.column = position.column;
    }

    public static parse(node: JsonExpressionNode|string, position?: SourcePosition): Fragment[] {
        return [...TemplateStringParser.from(node, position)];
    }

    public static from(value: JsonExpressionNode|string, position?: SourcePosition): TemplateStringParser {
        return new TemplateStringParser(
            TemplateStringParser.getExpression(value),
            position ?? (
                value instanceof JsonPrimitiveNode
                    ? value.location.start
                    : {index: 0, line: 1, column: 1}
            ),
        );
    }

    private static getExpression(node: JsonExpressionNode|string): string {
        if (typeof node === 'string') {
            return node;
        }

        return node instanceof JsonPrimitiveNode ? node.value : node.token.value;
    }

    private get position(): SourcePosition {
        return {
            index: this.index,
            line: this.line,
            column: this.column,
        };
    }

    public done(): boolean {
        return this.cursor >= this.chars.length;
    }

    public [Symbol.iterator](): Iterator<Fragment> {
        return this;
    }

    public next(): IteratorResult<Fragment> {
        return {
            done: this.done(),
            value: this.consume(),
        };
    }

    public consume(): Fragment {
        if (this.done()) {
            return this.createLiteralFragment('', this.position);
        }

        const start = this.position;
        let unclosedSingleQuotes = 0;
        let unclosedDoubleQuotes = 0;
        let unclosedBraces = 0;
        let source = '';

        while (this.cursor < this.chars.length) {
            const char = this.chars[this.cursor];
            const isExpressionStart = char === '$' && this.chars[this.cursor + 1] === '{';

            const nested = (unclosedBraces + unclosedSingleQuotes + unclosedDoubleQuotes) > 0;

            if (!nested && isExpressionStart && source.length > 0) {
                return this.createLiteralFragment(source, start);
            }

            this.cursor++;
            this.index++;

            if (char === '\n') {
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }

            source += char;

            if (unclosedSingleQuotes > 0 || unclosedDoubleQuotes > 0) {
                if (char === '\\') {
                    source += this.chars[this.cursor];

                    this.cursor++;
                    this.index++;
                    this.column++;
                } else if (unclosedSingleQuotes > 0 && char === "'") {
                    unclosedSingleQuotes--;
                } else if (unclosedDoubleQuotes > 0 && char === '"') {
                    unclosedDoubleQuotes--;
                }
            } else if (unclosedBraces > 0) {
                if (char === "'") {
                    unclosedSingleQuotes++;
                } else if (char === '"') {
                    unclosedDoubleQuotes++;
                } else if (char === '{') {
                    unclosedBraces++;
                } else if (char === '}') {
                    unclosedBraces--;
                }

                if (unclosedBraces === 0) {
                    return this.createExpressionFragment(source, start);
                }
            } else if (isExpressionStart) {
                source += this.chars[this.cursor];

                unclosedBraces++;
                this.cursor++;
                this.index++;
                this.column++;
            }
        }

        if (unclosedSingleQuotes > 0 || unclosedDoubleQuotes > 0) {
            throw new HelpfulError(
                'Unbalanced quotes in template string.',
                {
                    details: [
                        `Location: line ${start.line}, column ${start.column}`,
                    ],
                },
            );
        }

        if (unclosedBraces > 0) {
            throw new HelpfulError(
                'Unbalanced braces in template string.',
                {
                    details: [
                        `Location: line ${start.line}, column ${start.column}`,
                    ],
                },
            );
        }

        return this.createLiteralFragment(source, start);
    }

    private createLiteralFragment(source: string, start: SourcePosition): Fragment<'literal'> {
        return {
            type: 'literal',
            source: source,
            location: {
                start: start,
                end: this.position,
            },
        };
    }

    private createExpressionFragment(source: string, start: SourcePosition): Fragment<'expression'> {
        return {
            type: 'expression',
            source: source,
            expression: source.slice(2, -1).trim(),
            location: {
                start: start,
                end: this.position,
            },
        };
    }
}
