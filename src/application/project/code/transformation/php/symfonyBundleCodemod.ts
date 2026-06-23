import type {Codemod, ResultCode} from '@/application/project/code/transformation/codemod';
import {CodemodError} from '@/application/project/code/transformation/codemod';

export type Configuration = {
    /**
     * The fully-qualified bundle class to register (without a leading backslash).
     */
    bundle: string,
    required?: boolean,
};

/**
 * Registers a Symfony bundle in `config/bundles.php`.
 */
export class SymfonyBundleCodemod implements Codemod<string> {
    private readonly bundle: string;

    private readonly required: boolean;

    public constructor({bundle, required = false}: Configuration) {
        this.bundle = bundle;
        this.required = required;
    }

    public apply(input: string): Promise<ResultCode<string>> {
        if (input.includes(this.bundle)) {
            return Promise.resolve({modified: false, result: input});
        }

        // Bundle configs use `]` (e.g. `['all' => true]`), so the array's `];` is
        // the only one — its last occurrence is the insertion point.
        const closing = input.lastIndexOf('];');

        if (closing === -1) {
            if (this.required) {
                throw new CodemodError('No bundle array found in config/bundles.php to register the Croct bundle.');
            }

            return Promise.resolve({modified: false, result: input});
        }

        // Break onto its own line when inserting right after the opening `[` (e.g. `return [];`),
        // so the result stays readable even when no PHP formatter is available to fix it up.
        const leadingNewline = closing > 0 && input[closing - 1] !== '\n' ? '\n' : '';
        const entry = `${leadingNewline}    ${this.bundle}::class => ['all' => true],\n`;

        return Promise.resolve({
            modified: true,
            result: `${input.slice(0, closing)}${entry}${input.slice(closing)}`,
        });
    }
}
