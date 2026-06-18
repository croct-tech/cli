import type {Codemod, ResultCode} from '@/application/project/code/transformation/codemod';
import {CodemodError} from '@/application/project/code/transformation/codemod';

export type Configuration = {
    /**
     * The local settings filename that `settings.php` should include.
     */
    file: string,
    required?: boolean,
};

type Scan = {
    /**
     * Whether an active (non-commented) include of the file was found.
     */
    included: boolean,

    /**
     * The index of the line holding a commented-out include, or -1 if none.
     */
    commentIndex: number,
};

/**
 * Enables Drupal's local settings include in `settings.php`.
 */
export class DrupalLocalSettingsCodemod implements Codemod<string> {
    private static readonly INCLUDE_KEYWORDS = ['include_once', 'require_once', 'include', 'require'];

    private static readonly WORD_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789_';

    private readonly file: string;

    private readonly required: boolean;

    public constructor({file, required = false}: Configuration) {
        this.file = file;
        this.required = required;
    }

    public apply(input: string): Promise<ResultCode<string>> {
        if (input.trim() === '') {
            if (this.required) {
                throw new CodemodError('settings.php is empty; cannot add the settings.local.php include.');
            }

            return Promise.resolve({modified: false, result: input});
        }

        const result = DrupalLocalSettingsCodemod.scan(input, this.file);

        if (result.included) {
            return Promise.resolve({modified: false, result: input});
        }

        if (result.commentIndex >= 0) {
            const uncommented = DrupalLocalSettingsCodemod.uncomment(input, result.commentIndex);

            // Uncommenting in place only applies to a full-line comment; if it made
            // no change (the include is commented after code on the line), append.
            if (uncommented !== input) {
                return Promise.resolve({modified: true, result: uncommented});
            }
        }

        return Promise.resolve({modified: true, result: DrupalLocalSettingsCodemod.append(input, this.file)});
    }

    /**
     * Walks the source once and reports whether the file is already included.
     */
    private static scan(input: string, file: string): Scan {
        let mode: 'code' | 'string' | 'line' | 'block' = 'code';
        let quote = '';
        let statement = ''; // code of the current statement (reset on `;`)
        let buffer = ''; // current string or comment contents
        let line = 0;
        let bufferLine = 0; // line on which the current comment started
        let commentIndex = -1; // first commented-out include, or -1
        let index = 0;

        while (index < input.length) {
            const char = input[index];
            const next = input[index + 1] ?? '';

            if (mode === 'code') {
                if (char === "'" || char === '"') {
                    mode = 'string';
                    quote = char;
                    buffer = '';
                } else if (char === '/' && next === '*') {
                    mode = 'block';
                    index += 2;

                    continue;
                } else if ((char === '/' && next === '/') || char === '#') {
                    mode = 'line';
                    buffer = '';
                    bufferLine = line;
                    index += char === '#' ? 1 : 2;

                    continue;
                } else if (char === ';') {
                    statement = '';
                } else {
                    statement += char;
                }
            } else if (mode === 'string') {
                if (char === '\\') {
                    buffer += char + next;
                    index += 2;

                    continue;
                }

                if (char === quote) {
                    mode = 'code';

                    if (buffer.includes(file) && DrupalLocalSettingsCodemod.hasKeyword(statement)) {
                        return {included: true, commentIndex: -1};
                    }
                } else {
                    buffer += char;
                }
            } else if (mode === 'line') {
                if (char === '\n') {
                    mode = 'code';

                    // Record the first commented include but keep scanning: a later
                    // active include must override it.
                    if (commentIndex < 0 && DrupalLocalSettingsCodemod.isCommentedInclude(buffer, file)) {
                        commentIndex = bufferLine;
                    }
                } else {
                    buffer += char;
                }
            } else if (char === '*' && next === '/') {
                // Reached only in block-comment mode. A block comment is skipped
                // wholesale: a block-commented include is neither active nor
                // line-uncommentable, so it falls through to append.
                mode = 'code';
                index += 2;

                continue;
            }

            if (char === '\n') {
                line += 1;
            }

            index += 1;
        }

        // A line comment may run to the end of the file without a trailing newline.
        if (commentIndex < 0 && mode === 'line' && DrupalLocalSettingsCodemod.isCommentedInclude(buffer, file)) {
            commentIndex = bufferLine;
        }

        return {included: false, commentIndex: commentIndex};
    }

    private static isCommentedInclude(comment: string, file: string): boolean {
        return comment.includes(file) && DrupalLocalSettingsCodemod.hasKeyword(comment);
    }

    private static uncomment(input: string, target: number): string {
        const lines = input.split('\n');

        lines[target] = DrupalLocalSettingsCodemod.stripMarker(lines[target]);

        // When the include sits in a commented `if (...) {`, uncomment the opener
        // (directly above) and its closing brace (directly below) so the block stays
        // balanced. Drupal's stock block is exactly these three lines.
        const opener = target > 0 ? lines[target - 1] : '';

        if (
            DrupalLocalSettingsCodemod.isComment(opener)
            && DrupalLocalSettingsCodemod.isIfOpener(DrupalLocalSettingsCodemod.stripMarker(opener))
        ) {
            lines[target - 1] = DrupalLocalSettingsCodemod.stripMarker(opener);

            const closer = target + 1 < lines.length ? lines[target + 1] : '';

            if (
                DrupalLocalSettingsCodemod.isComment(closer)
                && DrupalLocalSettingsCodemod.stripMarker(closer)
                    .trimStart()
                    .startsWith('}')
            ) {
                lines[target + 1] = DrupalLocalSettingsCodemod.stripMarker(closer);
            }
        }

        return lines.join('\n');
    }

    private static append(input: string, file: string): string {
        const path = `$app_root . '/' . $site_path . '/${file}'`;
        const block = [
            `if (file_exists(${path})) {`,
            `    include ${path};`,
            '}',
            '',
        ].join('\n');

        const base = input.endsWith('\n') ? input : `${input}\n`;

        return `${base}\n${block}`;
    }

    private static hasKeyword(text: string): boolean {
        const lower = text.toLowerCase();

        return DrupalLocalSettingsCodemod.INCLUDE_KEYWORDS.some(keyword => {
            for (let at = lower.indexOf(keyword); at !== -1; at = lower.indexOf(keyword, at + 1)) {
                if (
                    !DrupalLocalSettingsCodemod.isWordChar(lower[at - 1])
                    && !DrupalLocalSettingsCodemod.isWordChar(lower[at + keyword.length])
                ) {
                    return true;
                }
            }

            return false;
        });
    }

    private static isWordChar(char: string | undefined): boolean {
        // Called with lowercased characters, so uppercase need not be considered.
        return char !== undefined && DrupalLocalSettingsCodemod.WORD_CHARS.includes(char);
    }

    private static isComment(line: string): boolean {
        const trimmed = line.trimStart();

        return trimmed.startsWith('#') || trimmed.startsWith('//');
    }

    private static isIfOpener(code: string): boolean {
        const trimmed = code.trim();

        return (trimmed.startsWith('if ') || trimmed.startsWith('if(')) && trimmed.endsWith('{');
    }

    private static stripMarker(line: string): string {
        let start = 0;

        while (line[start] === ' ' || line[start] === '\t') {
            start += 1;
        }

        const indent = line.slice(0, start);

        let rest = line.slice(start);

        if (rest.startsWith('//')) {
            rest = rest.slice(2);
        } else if (rest.startsWith('#')) {
            rest = rest.slice(1);
        } else {
            return line;
        }

        return indent + (rest.startsWith(' ') ? rest.slice(1) : rest);
    }
}
