import {TypedDocumentString} from '@/infrastructure/graphql/schema/graphql';
import {GraphqlClient} from '@/infrastructure/graphql';
import {generateSlug, NameProps} from '@/infrastructure/application/api/utils/generateSlug';

type AvailabilityResult = {
    checkAvailability: {
        slugFirstOption: boolean,
        slugSecondOption: boolean,
        slugThirdOption: boolean,
    },
};

type SlugOptions = {
    slugFirstOption: string,
    slugSecondOption: string,
    slugThirdOption: string,
};

type Document = TypedDocumentString<AvailabilityResult, SlugOptions>;

type AvailabilityCheck<T extends Document> = {
    baseName: string,
    query: T,
    client: GraphqlClient,
    alwaysSuffixed?: boolean,
} & (T extends TypedDocumentString<AvailabilityResult, infer V>
    ? (SlugOptions extends V ? {variables?: never} : {variables: Omit<V, keyof SlugOptions>})
    : {variables?: never}
);

export function generateAvailableSlug<T extends Document>(check: AvailabilityCheck<T>): Promise<string> {
    const {baseName, query, client, alwaysSuffixed} = check;

    return findAvailableName(
        {
            baseName: baseName,
            alwaysSuffixed: alwaysSuffixed,
        },
        async generator => {
            const options: string[] = [generator.next().value, generator.next().value, generator.next().value];

            const {data: {checkAvailability}} = await client.execute(query, {
                ...(check.variables ?? {}),
                slugFirstOption: options[0],
                slugSecondOption: options[1],
                slugThirdOption: options[2],
            });

            const availability = [
                checkAvailability.slugFirstOption,
                checkAvailability.slugSecondOption,
                checkAvailability.slugThirdOption,
            ];

            return options.find((_, index) => availability[index]) ?? null;
        },
    );
}

type AvailabilityChecker = (generator: Generator<string>) => Promise<string|null>;

async function findAvailableName(input: NameProps, checker: AvailabilityChecker): Promise<string> {
    const generator = generateSlug(input);

    let slug: string | null;

    do {
        slug = await checker(generator);
    } while (slug === null);

    return slug;
}
