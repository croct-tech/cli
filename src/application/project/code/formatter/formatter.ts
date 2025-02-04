import {Help, HelpfulError} from '@/application/error';

export class CodeFormatterError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, CodeFormatterError.prototype);
    }
}

export interface CodeFormatter {
    format(files: string[]): Promise<void>;
}
