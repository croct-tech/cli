import type {Codemod, ResultCode} from '@/application/project/code/transformation/codemod';
import {CodemodError} from '@/application/project/code/transformation/codemod';

export type NeonListOptions = {
    /**
     * The top-level key whose list the value is added to.
     */
    key: string,

    /**
     * The value to add to the list.
     */
    value: string,
};

type ParsedLine = {
    indentation: string,
    content: string,
};

type BlockSection = {
    type: 'block',
    keyIndex: number,
    values: string[],
    indentation: string | null,
};

type InlineSection = {
    type: 'inline',
};

type ListSection = BlockSection | InlineSection;

/**
 * Adds a value to a top-level list in a NEON document (e.g. PHPStan's `includes`).
 */
export class NeonListCodemod implements Codemod<string, NeonListOptions> {
    public apply(input: string, options: NeonListOptions): Promise<ResultCode<string>> {
        const lines = input.split('\n');
        const section = NeonListCodemod.findSection(lines, options.key);

        if (section !== null && section.type === 'inline') {
            throw new CodemodError(`Cannot add a value to the inline \`${options.key}\` list.`);
        }

        if (section !== null && section.values.includes(options.value)) {
            return Promise.resolve({modified: false, result: input});
        }

        return Promise.resolve({
            modified: true,
            result: NeonListCodemod.addValue(lines, section, options),
        });
    }

    private static addValue(
        lines: string[],
        section: BlockSection | null,
        {key, value}: NeonListOptions,
    ): string {
        if (section === null) {
            const block = `${key}:\n\t- ${value}`;
            const rest = lines.join('\n');

            return rest.trim() === '' ? `${block}\n` : `${block}\n\n${rest}`;
        }

        const indentation = section.indentation ?? '\t';

        lines.splice(section.keyIndex + 1, 0, `${indentation}- ${value}`);

        return lines.join('\n');
    }

    private static findSection(lines: string[], key: string): ListSection | null {
        const marker = `${key}:`;

        for (let index = 0; index < lines.length; index++) {
            const {indentation, content} = NeonListCodemod.parseLine(lines[index]);

            if (indentation !== '' || !content.startsWith(marker)) {
                continue;
            }

            if (content !== marker) {
                return {type: 'inline'};
            }

            return NeonListCodemod.collectItems(lines, index);
        }

        return null;
    }

    private static collectItems(lines: string[], keyIndex: number): BlockSection {
        const values: string[] = [];
        let indentation: string | null = null;

        for (let index = keyIndex + 1; index < lines.length; index++) {
            const line = NeonListCodemod.parseLine(lines[index]);

            if (line.content === '') {
                // Blank or comment-only line: still part of the block.
                continue;
            }

            if (line.indentation === '') {
                // Dedented to the next top-level key: the block has ended.
                break;
            }

            if (line.content.startsWith('-')) {
                indentation ??= line.indentation;
                values.push(NeonListCodemod.parseValue(line.content.slice(1).trim()));
            }
        }

        return {type: 'block', keyIndex: keyIndex, values: values, indentation: indentation};
    }

    private static parseLine(line: string): ParsedLine {
        const code = NeonListCodemod.stripComment(line);

        return {
            indentation: code.slice(0, code.length - code.trimStart().length),
            content: code.trim(),
        };
    }

    private static stripComment(line: string): string {
        let index = 0;

        while (index < line.length) {
            const char = line[index];

            if (char === "'" || char === '"') {
                index = NeonListCodemod.skipString(line, index);
            } else if (char === '#' && (index === 0 || line[index - 1] === ' ' || line[index - 1] === '\t')) {
                return line.slice(0, index);
            } else {
                index++;
            }
        }

        return line;
    }

    private static skipString(line: string, start: number): number {
        const quote = line[start];

        for (let index = start + 1; index < line.length; index++) {
            if (line[index] === quote) {
                return index + 1;
            }
        }

        return line.length;
    }

    private static parseValue(value: string): string {
        if (value.length >= 2 && (value[0] === "'" || value[0] === '"') && value[value.length - 1] === value[0]) {
            return value.slice(1, -1);
        }

        return value;
    }
}
