const MAX_SLUG_LENGTH = 30;
const MAX_SUFFIX_DIGITS = 4;

export type NameProps = {
    baseName: string,
    alwaysSuffixed?: boolean,
};

function truncate(slug: string, limit: number): string {
    return slug.slice(0, slug.indexOf('-', limit - 1) === limit - 1 ? limit - 1 : limit);
}

export function* generateSlug({baseName, alwaysSuffixed = false}: NameProps): Generator<string> {
    const fullName = baseName
        // Decompose combined graphemes into the combination of simple ones, e.g: é becomes e + '
        .normalize('NFD')
        .toLowerCase()
        // Remove non-letters
        .replace(/[^a-z ]/g, '')
        .trim()
        // Remove duplicate spaces
        .split(/\s+/);

    if (fullName.length === 0) {
        // Generate random string
        fullName.push(
            String.fromCharCode(97 + Math.floor(Math.random() * 26))
            + Math.random()
                .toString(36)
                .substring(2, 14),
        );
    }

    const base = fullName.slice(0, 2).join('-');

    if (!alwaysSuffixed) {
        yield truncate(base, MAX_SLUG_LENGTH);

        if (base.length < MAX_SLUG_LENGTH - 1 && fullName.length > 2) {
            yield truncate(fullName.join('-'), MAX_SLUG_LENGTH);
        }
    }

    while (true) {
        const suffix = Math.floor(Math.random() * (10 ** MAX_SUFFIX_DIGITS)).toString();
        const prefix = truncate(base, MAX_SLUG_LENGTH - suffix.length - 1);

        yield `${prefix}-${suffix}`;
    }
}
