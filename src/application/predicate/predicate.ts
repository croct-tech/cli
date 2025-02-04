export interface Predicate<A extends any[] = []> {
    test(...args: A): Promise<boolean>|boolean;
}
