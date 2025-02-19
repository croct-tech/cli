export function multiline(string: TemplateStringsArray, ...values: any[]): string {
    const parts: string[] = [];

    for (let index = 0; index < string.length; index++) {
        parts.push(string[index]);

        if (index < values.length) {
            parts.push(values[index]);
        }
    }

    const lines = parts.join('').split('\n');

    if (lines.length < 2) {
        return parts.join('');
    }

    const indent = lines[1].search(/\S/);

    return lines
        .map(line => line.slice(indent))
        .join('\n')
        .trim();
}
