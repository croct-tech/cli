/**
 * Resolves a given URL against a base URL.
 *
 * - If the `source` is an absolute URL (e.g., `https://example.com/path` or `file:///path`),
 *   it is returned as-is.
 * - If the `source` is a relative URL (e.g., `./path`, `../path`, `folder/file.txt`),
 *   it is resolved against `baseUrl`.
 * - If `baseUrl` has a non-hierarchical scheme (e.g., `mailto:`, `data:`, `github:`),
 *   relative URLs are resolved as if the base URL was hierarchical (e.g., `github:/user/repo`).
 *
 * @param source - The URL or path to resolve.
 * @param baseUrl - The base URL used for resolution.
 * @returns A fully resolved `URL` object.
 * @throws If the `source` is invalid or cannot be resolved against `baseUrl`.
 *
 * @example
 * resolveUrl('https://example.com/path', new URL('https://base.com/'));
 * // Returns: URL('https://example.com/path') (absolute URL remains unchanged)
 *
 * resolveUrl('images/logo.png', new URL('https://example.com/base/'));
 * // Returns: URL('https://example.com/base/images/logo.png') (relative path resolved)
 *
 * resolveUrl('../file.txt', new URL('https://example.com/folder/'));
 * // Returns: URL('https://example.com/file.txt') (parent directory resolution)
 *
 * resolveUrl('config.json', new URL('github:marcospassos/repo'));
 * // Returns: URL('github:/marcospassos/repo/config.json') (fixing non-hierarchical base)
 */
export function resolveUrl(source: string, baseUrl: URL): URL {
    if (URL.canParse(source)) {
        return new URL(source);
    }

    // If the base URL has a non-hierarchical scheme (like `github:` or `mailto:`),
    // ensure it follows a hierarchical structure by adding a slash after the scheme.
    const adjustedBase = new URL(baseUrl.href.replace(/^(.*:)(?!\/)/, '$1/'));

    return new URL(source, adjustedBase);
}
