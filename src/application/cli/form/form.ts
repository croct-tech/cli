export type FormOptions = Record<string, any>;

export interface Form<T, O extends FormOptions = FormOptions> {
    handle(options: O): Promise<T>;
}
