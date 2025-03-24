import {AttributeDefinition} from '@croct/content-model/definition/definition';

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

export function formatSlug(sentence: string): string {
    return sentence
        .normalize('NFD')
        .toLocaleLowerCase()
        .replace(/(^[^a-z]+|[^a-z0-9_ &-]+)/ig, '')
        .split(/[^a-z0-9]+/i)
        .filter(part => part !== '')
        .join('-');
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
