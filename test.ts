import {isAbsolute, join, relative} from 'path';

function isSubpath(parent: string, path: string): boolean {
    const relativePath = relative(parent, isAbsolute(path) ? path : join(parent, path));

    return !relativePath.startsWith('..') && !relativePath.startsWith('/');
}

console.log(isSubpath('/Users/marcospassos/Downloads/next-tailwind/app/marquee', './'));
