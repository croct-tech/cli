export function formatName(label: string): string {
    return label
        .normalize('NFD')
        .replace(/(^[^a-z]+|[^a-z0-9_ -]+)/ig, '')
        .split(/[^a-z0-9]+/i)
        .map(
            (word, index) => (
                index === 0
                    ? word.toLowerCase()
                    : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ),
        )
        .join('');
}
