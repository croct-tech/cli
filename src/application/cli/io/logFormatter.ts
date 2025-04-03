import {Semantics} from '@/application/cli/io/output';

export type Callout = {
    semantics: Semantics,
    title: string,
    message: string,
    alignment?: 'left' | 'center' | 'right',
};

export interface LogFormatter {
    formatCallout(callout: Callout): string;
    formatError(error: unknown): string;
}
