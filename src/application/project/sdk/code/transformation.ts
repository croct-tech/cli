export type TransformedCode<T> = {
    modified: boolean,
    result: T,
};

export interface CodeTransformer<I> {
    transform(input: I): TransformedCode<I>;
}
