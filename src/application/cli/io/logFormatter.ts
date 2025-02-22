import {Semantic} from '@/application/cli/io/output';

export type Callout = {
    semantics: Semantic,
    title: string,
    message: string,
    alignment?: 'left' | 'center' | 'right',
};

export interface LogFormatter {
    formatCallout(callout: Callout): string;
    formatError(error: unknown): string;
}
