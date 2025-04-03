import chalk, {ForegroundColorName} from 'chalk';
import isUnicodeSupported from 'is-unicode-supported';
import {render as renderMarkdown} from '@croct/md-lite/rendering.js';
import terminalLink from 'terminal-link';
import {unescape as unescapeMarkdown} from '@croct/md-lite/parsing.js';
import {strip} from 'node-emoji';
import {Semantics} from '@/application/cli/io/output';

const unicodeSupport = isUnicodeSupported();

export const colors: Record<Semantics, ForegroundColorName> = {
    neutral: 'cyan',
    info: 'blue',
    error: 'red',
    warning: 'yellow',
    success: 'green',
};

const icons: Record<Semantics, string> = {
    neutral: unicodeSupport ? '➜' : '>',
    info: unicodeSupport ? 'ℹ' : 'i',
    error: unicodeSupport ? '✘' : '×',
    warning: unicodeSupport ? '⚠' : '‼',
    success: unicodeSupport ? '✔' : '√',
};

export type FormatingOptions = {
    basic?: boolean,
    text?: Semantics,
    icon?: {
        semantics: Semantics,
        symbol?: {
            unicode: string,
            ascii: string,
        },
    },
};

export function format(message: string, options: FormatingOptions = {}): string {
    let result = options.basic === true ? message : render(message);

    if (!unicodeSupport) {
        result = strip(result);
    }

    if (options.text !== undefined) {
        result = chalk[colors[options.text]](result);
    }

    if (options.icon !== undefined) {
        const {semantics, symbol} = options.icon;

        result = symbol !== undefined
            ? `${chalk[colors[semantics]](symbol[unicodeSupport ? 'unicode' : 'ascii'])} ${result}`
            : `${chalk[colors[semantics]](icons[semantics])} ${result}`;
    }

    return result;
}

function render(message: string): string {
    return renderMarkdown<string>(message, {
        fragment: node => node.children.join(''),
        text: node => node.content,
        bold: node => chalk.bold(node.children),
        italic: node => chalk.italic(node.children),
        strike: node => chalk.strikethrough(node.children),
        code: node => chalk.cyan(node.content),
        link: node => terminalLink(node.children, node.href, {
            fallback: (text, url) => `${text} (${url})`,
        }),
        image: node => unescapeMarkdown(node.source),
        paragraph: node => `${node.children.join('')}\n\n`,
    }).trim();
}
