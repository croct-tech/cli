import stripAnsi from 'strip-ansi';

type Cursor = {
    row: number,
    column: number,
};

export class AnsiScreenEmulator {
    private lines: string[][] = [[]];

    private cursor: Cursor = {
        row: 0,
        column: 0,
    };

    private ansiSequence: string = ''; // To store ongoing ANSI sequences

    public constructor() {
        this.lines = [[]];
    }

    /**
     * Buffers the incoming terminal output while processing ANSI escape sequences.
     * @param data - The raw output from the terminal.
     */
    public buffer(data: string): void {
        for (let i = 0; i < data.length; i++) {
            const char = data[i];

            if (char === '\\x1b') { // Start of an ANSI sequence
                this.ansiSequence = '\\x1b';

                continue;
            }

            if (this.ansiSequence.length > 0) {
                this.ansiSequence += char;

                // Check if the sequence is completed
                if (/[A-Za-z]/.test(char)) {
                    this.processAnsiSequence(this.ansiSequence);
                    this.ansiSequence = '';
                }

                continue;
            }

            if (char === '\r') {
                this.cursor.column = 0;

                continue;
            }

            if (char === '\n') {
                this.cursor.row++;
                this.cursor.column = 0;
                this.resize(this.cursor.row);

                continue;
            }

            this.resize(this.cursor.row);

            while (this.lines[this.cursor.row].length < this.cursor.column) {
                this.lines[this.cursor.row].push(' ');
            }

            this.lines[this.cursor.row][this.cursor.column] = char;
            this.cursor.column++;
        }
    }

    /**
     * Processes an ANSI escape sequence (cursor movement, clearing lines, etc.).
     * @param sequence - The full ANSI sequence (e.g., "\x1b[2K" or "\x1b[32m").
     */
    private processAnsiSequence(sequence: string): void {
        const match = sequence.match(/^\\x1b\[(\d*;?\d*)?([A-Za-z])$/);

        if (match === null) {
            return; // Ignore invalid ANSI sequences
        }

        const [, argList, command] = match;

        const args = argList?.split(';')
            .map(arg => (arg === '' ? 0 : Number.parseInt(arg, 10)))
            ?? [];

        switch (command) {
            case 'A': // Cursor Up
                this.cursor.row = Math.max(0, this.cursor.row - (args[0] ?? 1));

                break;

            case 'B': // Cursor Down
                this.cursor.row += args[0] ?? 1;
                this.resize(this.cursor.row);

                break;

            case 'C': // Cursor Right
                this.cursor.column += args[0] ?? 1;

                break;

            case 'D': // Cursor Left
                this.cursor.column = Math.max(0, this.cursor.column - (args[0] ?? 1));

                break;

            case 'K': // Erase Line
                if (args[0] === 2) {
                    this.lines[this.cursor.row] = [];
                } else if (args[0] === 0) {
                    this.lines[this.cursor.row] = this.lines[this.cursor.row].slice(0, this.cursor.column);
                }

                break;

            case 'J': // Erase Screen
                if (args[0] === 2) {
                    this.lines = [[]];
                    this.cursor = {row: 0, column: 0};
                } else if (args[0] === 0) {
                    this.lines = this.lines.slice(0, this.cursor.row + 1);
                    this.lines[this.cursor.row] = this.lines[this.cursor.row].slice(0, this.cursor.column);
                }

                break;

            default:
                // Preserve non-movement ANSI sequences (colors, styles, etc.)
                this.resize(this.cursor.row);
                this.lines[this.cursor.row].push(sequence);

                break;
        }
    }

    /**
     * Ensures that the specified row exists in the screen buffer.
     * @param row - The row index to ensure exists.
     */
    private resize(row: number): void {
        while (this.lines.length <= row) {
            this.lines.push([]);
        }
    }

    /**
     * Returns the processed terminal output as a formatted string.
     * @returns The final screen state as a string.
     */
    public toString(): string {
        return this.lines
            .map(line => line.join(''))
            .join('\n')
            .trim();
    }

    public toRawString(): string {
        return stripAnsi(this.toString());
    }
}
