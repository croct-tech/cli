import {isIdentifier} from '@croct/json5-parser';

type CodeStyle = {
    delimiter: string,
    stringKeys?: boolean,
};

export class CodeWriter {
    private code: string = '';

    private indentationLevel: number = 0;

    public readonly indentationSize: number;

    public constructor(indentationSize: number = 2) {
        this.indentationSize = indentationSize;
    }

    public indent(): this {
        this.indentationLevel++;

        return this;
    }

    public outdent(): this {
        if (this.indentationLevel > 0) {
            this.indentationLevel--;
        }

        return this;
    }

    public newLine(count: number = 1): this {
        this.code += '\n'.repeat(count);

        return this;
    }

    public write(line: string, newLine: boolean = true): this {
        this.code += this.indentCode(`${line}`) + (newLine ? '\n' : '');

        return this;
    }

    public appendString(value: string, delimiter: string): this {
        return this.append(delimiter + value.replace(new RegExp(delimiter, 'g'), `\\${delimiter}`) + delimiter);
    }

    public appendIndentation(): this {
        return this.write('', false);
    }

    public appendName(name: string, capitalize = true): this {
        this.code += CodeWriter.formatName(name, capitalize);

        return this;
    }

    public writeValue(value: any, style: CodeStyle): this {
        return this.appendIndentation().appendValue(value, style);
    }

    public append(content: string): this {
        this.code += this.indentCode(content, false);

        return this;
    }

    public appendValue(value: any, style: CodeStyle): this {
        const {delimiter, stringKeys = false} = style;

        switch (typeof value) {
            case 'string': {
                const escapedString = value.replace(new RegExp(delimiter, 'g'), `\\${delimiter}`);

                return this.append(`${delimiter}${escapedString}${delimiter}`);
            }

            case 'number':
            case 'boolean':
                return this.append(`${value}`);

            case 'object': {
                if (value === null) {
                    return this.append('null');
                }

                if (Array.isArray(value)) {
                    if (value.length === 0) {
                        return this.append('[]');
                    }

                    this.append('[')
                        .newLine()
                        .indent();

                    for (let index = 0; index < value.length; index++) {
                        this.appendIndentation()
                            .appendValue(value[index], style);

                        if (index < value.length - 1) {
                            this.append(', ')
                                .newLine();
                        }
                    }

                    return this
                        .outdent()
                        .newLine()
                        .write(']', false);
                }

                const entries = Object.entries(value);

                if (entries.length === 0) {
                    return this.append('{}');
                }

                this.append('{')
                    .newLine()
                    .indent();

                for (let index = 0; index < entries.length; index++) {
                    const [entryKey, entryValue] = entries[index];

                    this.appendIndentation();

                    if (stringKeys || !isIdentifier(entryKey)) {
                        this.appendValue(entryKey, style);
                    } else {
                        this.append(entryKey);
                    }

                    this.append(': ')
                        .appendValue(entryValue, style);

                    if (index < entries.length - 1) {
                        this.append(', ')
                            .newLine();
                    }
                }

                return this
                    .outdent()
                    .newLine()
                    .write('}', false);
            }

            default:
                return this.append('undefined');
        }
    }

    private indentCode(code: string, prepend = true): string {
        const indentation = ' '.repeat(this.indentationLevel * this.indentationSize);

        return (prepend ? indentation : '') + code.replace(/\n/g, `\n${indentation}`);
    }

    public toString(): string {
        return this.code;
    }

    public static formatName(name: string, capitalize = true): string {
        const snakeCase = name.replace(/[^a-z0-9]/gi, '_');

        if (name.includes('_')) {
            return capitalize
                ? snakeCase[0].toUpperCase() + snakeCase.slice(1)
                : snakeCase;
        }

        return snakeCase.replace(
            /(^[a-z_])|_([a-z])/gi,
            (_, first, second, index) => (
                capitalize || index > 0
                    ? (first ?? second).toUpperCase()
                    : (first ?? second).toLowerCase()
            ),
        );
    }
}
