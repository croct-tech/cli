import chalk, {ChalkInstance} from 'chalk';
import isUnicodeSupported from 'is-unicode-supported';
import {render as renderMarkdown} from '@croct/md-lite/rendering';
import terminalLink from 'terminal-link';
import {unescape as unscapeMarkdown} from '@croct/md-lite/parsing';

const unicodeSupport = isUnicodeSupported();

export type Semantic = 'neutral' | 'info' | 'error' | 'warning' | 'success';

const colors: Record<Semantic, ChalkInstance> = {
    neutral: chalk.cyan,
    info: chalk.blue,
    error: chalk.red,
    warning: chalk.yellow,
    success: chalk.green,
};

const icons: Record<Semantic, string> = {
    neutral: colors.neutral(unicodeSupport ? '➜' : '>'),
    info: colors.info(unicodeSupport ? 'ℹ' : 'i'),
    error: colors.error(unicodeSupport ? '✘' : '×'),
    warning: colors.warning(unicodeSupport ? '⚠' : '‼'),
    success: colors.success(unicodeSupport ? '✔' : '√'),
};

export type FormatingOptions = {
    text?: Semantic,
    icon?: {
        semantic: Semantic,
        symbol?: {
            unicode: string,
            ascii: string,
        },
    },
};

export function format(message: string, options: FormatingOptions = {}): string {
    let result = render(message);

    if (options.text !== undefined) {
        result = colors[options.text](result);
    }

    if (options.icon !== undefined) {
        const {semantic, symbol} = options.icon;

        result = symbol !== undefined
            ? `${colors[semantic](symbol[unicodeSupport ? 'unicode' : 'ascii'])} ${result}`
            : `${icons[semantic]} ${result}`;
    }

    return result;
}

function render(message: string): string {
    return renderMarkdown(message, {
        fragment: node => node.children.join(''),
        text: node => node.content,
        bold: node => chalk.bold(node.children),
        italic: node => chalk.italic(node.children),
        strike: node => chalk.strikethrough(node.children),
        code: node => chalk.cyan(node.content),
        link: node => terminalLink(node.children, node.href, {
            fallback: (text, url) => `${text} (${url})`,
        }),
        image: node => unscapeMarkdown(node.source),
        paragraph: node => node.children.join('\n'),
    });
}
