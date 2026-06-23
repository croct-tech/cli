import type {Codemod, ResultCode} from '@/application/project/code/transformation/codemod';

export type YamlMappingOptions = {
    /**
     * The top-level mapping key.
     */
    key: string,

    /**
     * The nested `name: value` entries.
     *
     * Values are written verbatim, so the caller controls quoting
     * and any framework-specific syntax (e.g. Symfony `%env()%`).
     */
    entries: Record<string, string>,
};

/**
 * Ensures a top-level YAML mapping exists in a configuration file.
 *
 * Appends `<key>:` with the given entries when the key is absent, creating the
 * file from empty input, and is a no-op when a top-level `<key>:` is already
 * present.
 */
export class YamlMappingCodemod implements Codemod<string, YamlMappingOptions> {
    public apply(input: string, options: YamlMappingOptions): Promise<ResultCode<string>> {
        if (YamlMappingCodemod.hasKey(input, options.key)) {
            return Promise.resolve({modified: false, result: input});
        }

        return Promise.resolve({modified: true, result: YamlMappingCodemod.append(input, options)});
    }

    private static hasKey(input: string, key: string): boolean {
        const marker = `${key}:`;

        return input.split('\n').some(line => line.startsWith(marker));
    }

    private static append(input: string, {key, entries}: YamlMappingOptions): string {
        const block = [
            `${key}:`,
            ...Object.entries(entries).map(([name, value]) => `    ${name}: ${value}`),
            '',
        ].join('\n');

        if (input.trim() === '') {
            return block;
        }

        const base = input.endsWith('\n') ? input : `${input}\n`;

        return `${base}\n${block}`;
    }
}
