import {sep} from 'path';
import {AttributeDefinition} from '@/application/project/example/content-model/definitions';

export function formatLabel(name: string): string {
    const parts = name.split(/(?<![A-Z])(?=[A-Z])|_/);

    const firstWord = parts[0];
    const firstLetter = firstWord[0];

    const labels = [
        firstLetter.toUpperCase() + firstWord.slice(1).toLowerCase(),
        ...parts.slice(1).map(part => part.toLowerCase()),
    ];

    return labels.join(' ');
}

type AttributePosition = Pick<AttributeDefinition, 'position'>;

type OrderedAttributeMap<T extends AttributePosition = AttributePosition> = Record<string, T>;

export function sortAttributes<T extends AttributePosition>(attributes: OrderedAttributeMap<T>): Array<[string, T]> {
    return Object.entries(attributes)
        .sort(([, left], [, right]) => {
            const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
            const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;

            return leftPosition - rightPosition;
        });
}

export function normalizePath(path: string): string {
    if (path === '') {
        return path;
    }

    return path.replace(/[\\/]+/g, sep);
}
