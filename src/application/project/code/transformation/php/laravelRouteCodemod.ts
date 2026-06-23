import type {Codemod, ResultCode} from '@/application/project/code/transformation/codemod';

export type RouteOptions = {
    /**
     * The slot ID fetched by the route.
     */
    slot: string,

    /**
     * The route URL, which also serves as the idempotency key.
     */
    url: string,

    /**
     * The Blade view that renders the slot content.
     */
    view: string,
};

/**
 * Registers a Laravel route in `routes/web.php`.
 *
 * The route is appended to the file. Registration is idempotent on the URL: if a
 * route for the URL is already defined in active code, the file is left unchanged.
 */
export class LaravelRouteCodemod implements Codemod<string, RouteOptions> {
    public apply(input: string, options?: RouteOptions): Promise<ResultCode<string>> {
        if (
            options === undefined
            || input.trim() === ''
            || LaravelRouteCodemod.isRegistered(input, options.url)
        ) {
            return Promise.resolve({modified: false, result: input});
        }

        return Promise.resolve({modified: true, result: LaravelRouteCodemod.append(input, options)});
    }

    /**
     * Checks whether the given URL is already registered in the given source code.
     */
    private static isRegistered(input: string, url: string): boolean {
        let mode: 'code' | 'string' | 'line' | 'block' = 'code';
        let quote = '';
        let statement = ''; // code of the current statement (reset on `;`)
        let buffer = ''; // current string contents
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

                    // The URL counts only as the argument of a `Route::` call, not as
                    // an unrelated string literal.
                    if (buffer === url && statement.includes('Route::')) {
                        return true;
                    }
                } else {
                    buffer += char;
                }
            } else if (mode === 'line') {
                if (char === '\n') {
                    mode = 'code';
                }
            } else if (char === '*' && next === '/') {
                // Reached only in block-comment mode.
                mode = 'code';
                index += 2;

                continue;
            }

            index += 1;
        }

        return false;
    }

    private static append(input: string, options: RouteOptions): string {
        const block = [
            '',
            `Route::get('${options.url}', static function (\\Croct\\Plug\\Plug $croct) {`,
            `    return view('${options.view}', [`,
            `        'content' => $croct->fetchContent('${options.slot}')->getContent(),`,
            '    ]);',
            '});',
            '',
        ].join('\n');

        const base = input.endsWith('\n') ? input : `${input}\n`;

        return `${base}${block}`;
    }
}
