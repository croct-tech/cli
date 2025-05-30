import stripAnsi from 'strip-ansi';

type Cursor = {
    row: number,
    column: number,
};

export class ScreenBuffer {
    private lines: string[][] = [[]];

    private cursor: Cursor = {
        row: 0,
        column: 0,
    };

    private snapshot: string[][] = [[]];

    private ansiSequence: string = '';

    public constructor() {
        this.lines = [[]];
    }

    /**
     * Buffers the incoming terminal output while processing ANSI escape sequences.
     * @param data - The raw output from the terminal.
     */
    public write(data: string): void {
        for (let i = 0; i < data.length; i++) {
            const char = data[i];

            if (char === '\x1b') { // Start of an ANSI sequence
                this.ansiSequence = '\x1b';

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
                const line = this.lines[this.cursor.row];

                for (let index = this.cursor.column; index < line.length; index++) {
                    line[index] = ' ';
                }

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
        // eslint-disable-next-line no-control-regex -- More readable regex for ANSI sequences
        const match = sequence.match(/\x1b\[(\d*(?:;\d+)*)?([A-Za-z])/);

        if (match === null) {
            // Ignore unrelated sequences
            this.lines[this.cursor.row].push(sequence);

            return;
        }

        const [, argList, command] = match;

        const args = argList?.split(';')
            .map(arg => (arg === '' ? 0 : Number.parseInt(arg, 10)))
            ?? [];

        switch (command) {
            // Cursor Up
            case 'A': {
                const rows = args[0] ?? 1;

                this.cursor.row = Math.max(0, this.cursor.row - rows);

                break;
            }

            // Cursor Down
            case 'B': {
                const rows = args[0] ?? 1;

                this.cursor.row += rows;
                this.resize(this.cursor.row);

                break;
            }

            // Cursor Right
            case 'C': {
                const cols = args[0] ?? 1;

                this.cursor.column += cols;

                break;
            }

            // Cursor Left
            case 'D': {
                const cols = args[0] ?? 1;

                this.cursor.column = Math.max(0, this.cursor.column - cols);

                break;
            }

            // Next Line (cursor down n and column 0)
            case 'E': {
                const rows = args[0] ?? 1;

                this.cursor.row += rows;
                this.resize(this.cursor.row);
                this.cursor.column = 0;

                break;
            }

            // Previous Line (cursor up n and column 0)
            case 'F': {
                const rows = args[0] ?? 1;

                this.cursor.row = Math.max(0, this.cursor.row - rows);
                this.cursor.column = 0;

                break;
            }

            // Cursor Horizontal Absolute
            case 'G': {
                const col = (args[0] ?? 1) - 1;

                this.cursor.column = Math.max(0, col);

                break;
            }

            // Cursor Position
            case 'H':
            case 'f': {
                const row = (args[0] ?? 1) - 1;
                const col = (args[1] ?? 1) - 1;

                this.cursor.row = Math.max(0, row);
                this.resize(this.cursor.row);
                this.cursor.column = Math.max(0, col);

                break;
            }

            // Erase in Line
            case 'K': {
                const mode = args[0] ?? 0;
                const line = this.lines[this.cursor.row];

                switch (mode) {
                    // Cursor to end of line (inclusive)
                    case 0:
                        line.length = this.cursor.column;

                        break;

                    // Start to cursor (inclusive)
                    case 1:
                        for (let column = 0; column <= this.cursor.column; column++) {
                            line[column] = ' ';
                        }

                        break;

                    // Entire line
                    case 2:
                        for (let column = 0; column < line.length; column++) {
                            line[column] = ' ';
                        }

                        break;
                }

                break;
            }

            // Erase in Display
            case 'J': {
                const mode = args[0] ?? 0;

                switch (mode) {
                    // Cursor to end of screen
                    case 0: {
                        // Clear from current line after cursor
                        this.lines[this.cursor.row].length = this.cursor.column;
                        // Remove all lines below
                        this.lines.length = this.cursor.row + 1;

                        break;
                    }

                    // Start to cursor
                    case 1: {
                        // Remove all lines above
                        this.lines = this.lines.slice(this.cursor.row);

                        // Clear part of the current line up to cursor
                        for (let column = 0; column <= this.cursor.column; column++) {
                            this.lines[0][column] = ' ';
                        }

                        break;
                    }

                    // Entire screen
                    case 2: {
                        this.lines = [[]];
                        this.cursor = {
                            row: 0,
                            column: 0,
                        };

                        break;
                    }
                }

                break;
            }

            // Preserve non-movement ANSI sequences (colors, styles, etc.)
            default:
                this.resize(this.cursor.row);
                this.lines[this.cursor.row].push(sequence);

                break;
        }
    }

    private resize(row: number): void {
        while (this.lines.length <= row) {
            this.lines.push([]);
        }
    }

    public getSnapshot(): string {
        return this.lines
            .map(line => line.join(''))
            .join('\n');
    }

    public saveSnapshot(): void {
        this.snapshot = this.lines.map(line => [...line]);
    }

    public getSnapshotDiff(): string {
        const diff: string[] = [];

        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            const line = this.lines[lineIndex];

            if (this.snapshot[lineIndex] === undefined) {
                diff.push(line.join(''));

                continue;
            }

            for (let columnIndex = 0; columnIndex < line.length; columnIndex++) {
                if (line[columnIndex] !== this.snapshot[lineIndex][columnIndex]) {
                    diff.push(line.join(''));

                    break;
                }
            }
        }

        return diff.join('\n');
    }

    public static getRawString(data: string): string {
        return stripAnsi(data);
    }
}
