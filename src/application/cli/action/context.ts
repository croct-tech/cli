import {JsonPrimitive} from '@croct/json';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {ActionError} from '@/application/cli/action/action';
import {CliErrorCode} from '@/application/cli/error';

export type LazyValue = () => Promise<JsonPrimitive|JsonPrimitive[]>;

type VariableMap = Record<string, JsonPrimitive|JsonPrimitive[]|LazyValue>;

export type Configuration = {
    input?: Input,
    output: Output,
    variables?: VariableMap,
};

type TypeValidator<T> = (value: unknown) => value is T;

export class ActionContext {
    public readonly input?: Input;

    public readonly output: Output;

    private readonly variables: VariableMap;

    public constructor(config: Configuration) {
        this.input = config.input;
        this.output = config.output;
        this.variables = config.variables ?? {};
    }

    public getVariables(): VariableMap {
        return {...this.variables};
    }

    public resolvePrimitive(reference: string): Promise<JsonPrimitive> {
        return this.resolveValue(
            reference,
            (value): value is JsonPrimitive => ['string', 'number', 'boolean'].includes(typeof value),
            ['string', 'number', 'boolean'],
        );
    }

    public resolveString(reference: string): Promise<string> {
        return this.resolveValue(
            reference,
            (value): value is string => typeof value === 'string',
            ['string'],
        );
    }

    public resolveNumber(reference: string): Promise<number> {
        return this.resolveValue(
            reference,
            (value): value is number => typeof value === 'number',
            ['number'],
        );
    }

    public resolveBoolean(reference: string): Promise<boolean> {
        return this.resolveValue(
            reference,
            (value): value is boolean => typeof value === 'boolean',
            ['boolean'],
        );
    }

    public resolveStringList(reference: string): Promise<string[]> {
        return this.resolveList(reference, (value): value is string => typeof value === 'string', ['string']);
    }

    public resolveNumberList(reference: string): Promise<number[]> {
        return this.resolveList(reference, (value): value is number => typeof value === 'number', ['number']);
    }

    public resolveBooleanList(reference: string): Promise<boolean[]> {
        return this.resolveList(reference, (value): value is boolean => typeof value === 'boolean', ['boolean']);
    }

    private async resolveList<T>(reference: string, validator: TypeValidator<T>, types: string[]): Promise<T[]> {
        const value = await this.resolve(reference);

        if (!Array.isArray(value)) {
            throw new ActionError(
                `Expected reference \`${reference}\` to be a list, `
                + `but got ${ActionContext.getType(value)}.`,
            );
        }

        const list: T[] = [];

        for (const item of value) {
            if (!validator(item)) {
                throw new ActionError(
                    `Expected reference \`${reference}\` to be a list of ${types.join(' or ')}, `
                    + `but got ${ActionContext.getType(item)}.`,
                    {
                        code: CliErrorCode.INVALID_INPUT,
                    },
                );
            }

            list.push(item);
        }

        return list;
    }

    private async resolveValue<T>(reference: string, validator: TypeValidator<T>, types: string[]): Promise<T> {
        const value = await this.resolve(reference);

        if (!validator(value)) {
            throw new ActionError(
                `Expected reference \`${reference}\` to be of type ${types.join(' or ')}, `
                + `but got ${ActionContext.getType(value)}.`,
                {
                    code: CliErrorCode.INVALID_INPUT,
                },
            );
        }

        return value;
    }

    public async resolve(reference: string): Promise<JsonPrimitive|JsonPrimitive[]> {
        const fullMatch = /\{\{(.*?)}}/.exec(reference);

        if (fullMatch !== null && fullMatch[0] === reference) {
            const variable = fullMatch[1].trim();
            const value = await this.get(variable, true);

            if (value === null) {
                throw new ActionError(`Undefined placeholder variable \`${variable}\`.`, {
                    code: CliErrorCode.INVALID_INPUT,
                });
            }

            return value;
        }

        const regex = /\{\{(.*?)}}/g;
        const promises: Record<string, Promise<JsonPrimitive|JsonPrimitive[]>> = {};

        for (const match of reference.matchAll(regex)) {
            const variable = match[1].trim();

            promises[variable] = this.get(variable, true);
        }

        const replacements = Object.fromEntries(
            await Promise.all(
                Object.entries(promises).map(
                    async ([variable, promise]) => [variable, await promise],
                ),
            ),
        );

        return reference.replace(regex, (_, placeholder) => {
            const variable = placeholder.trim();
            const placeholderValue = replacements[variable];

            if (placeholderValue === null) {
                throw new ActionError(`Undefined placeholder variable \`${variable}\`.`, {
                    code: CliErrorCode.INVALID_INPUT,
                });
            }

            return Array.isArray(placeholderValue)
                ? placeholderValue.join(', ')
                : `${placeholderValue}`;
        });
    }

    public set(variable: string, value: JsonPrimitive|JsonPrimitive[]|LazyValue): void {
        this.variables[variable] = value;
    }

    public get(variable: string, optional?: false): Promise<Exclude<JsonPrimitive, null>>;

    public get(variable: string, optional: true): Promise<JsonPrimitive>;

    public get(variable: string, optional?: boolean): Promise<JsonPrimitive>;

    public async get(variable: string, optional: boolean = false): Promise<JsonPrimitive|JsonPrimitive[]> {
        const value = this.variables[variable] ?? null;

        if (typeof value === 'function') {
            this.variables[variable] = await value();

            return this.get(variable, optional);
        }

        if (value === null && !optional) {
            throw new ActionError(`Variable \`${variable}\` is not defined.`, {
                code: CliErrorCode.INVALID_INPUT,
            });
        }

        return value;
    }

    public getString(variable: string, optional?: false): Promise<string>;

    public getString(variable: string, optional: true): Promise<string | null>;

    public getString(variable: string, optional?: boolean): Promise<string | null>;

    public getString(variable: string, optional = false): Promise<string | null> {
        return this.getValue(
            variable,
            (value): value is string => typeof value === 'string',
            optional ? ['string', 'null'] : ['string'],
        );
    }

    public getNumber(variable: string, optional?: false): Promise<number>;

    public getNumber(variable: string, optional: true): Promise<number | null>;

    public getNumber(variable: string, optional?: boolean): Promise<number | null>;

    public getNumber(variable: string, optional = false): Promise<number | null> {
        return this.getValue(
            variable,
            (value): value is number => typeof value === 'number',
            optional ? ['number', 'null'] : ['number'],
        );
    }

    public getBoolean(variable: string, optional?: false): Promise<boolean>;

    public getBoolean(variable: string, optional: true): Promise<boolean | null>;

    public getBoolean(variable: string, optional?: boolean): Promise<boolean | null>;

    public getBoolean(variable: string, optional = false): Promise<boolean | null> {
        return this.getValue(
            variable,
            (value): value is boolean => typeof value === 'boolean',
            optional ? ['boolean', 'null'] : ['boolean'],
        );
    }

    private async getValue<T>(variable: string, validator: TypeValidator<T>, types: string[]): Promise<T | null> {
        const optional = types.includes('null');
        const value = await this.get(variable, optional);

        if (value === null) {
            if (optional) {
                return null;
            }

            throw new ActionError(`Variable \`${variable}\` is not defined.`, {
                code: CliErrorCode.INVALID_INPUT,
            });
        }

        if (!validator(value)) {
            throw new ActionError(
                `Expected variable \`${variable}\` to be of type ${types.join(' or ')}, `
                + `but got ${ActionContext.getType(value)}.`,
                {
                    code: CliErrorCode.INVALID_INPUT,
                },
            );
        }

        return value;
    }

    public getList(variable: string, optional?: false): Promise<JsonPrimitive[]>;

    public getList(variable: string, optional: true): Promise<JsonPrimitive[] | null>;

    public getList(variable: string, optional?: boolean): Promise<JsonPrimitive[] | null>;

    public async getList(variable: string, optional = false): Promise<JsonPrimitive[] | null> {
        const value = await this.get(variable, optional);

        if (value === null) {
            return null;
        }

        if (!Array.isArray(value)) {
            throw new ActionError(
                `Expected variable \`${variable}\` to be a list, `
                + `but got ${ActionContext.getType(value)}.`,
                {
                    code: CliErrorCode.INVALID_INPUT,
                },
            );
        }

        return value;
    }

    public getStringList(variable: string, optional?: false): Promise<string[]>;

    public getStringList(variable: string, optional: true): Promise<string[] | null>;

    public getStringList(variable: string, optional?: boolean): Promise<string[] | null>;

    public getStringList(variable: string, optional = false): Promise<string[] | null> {
        return this.getValidatedList(
            variable,
            (value): value is string => typeof value === 'string',
            optional,
            ['string'],
        );
    }

    public getNumberList(variable: string, optional?: false): Promise<number[]>;

    public getNumberList(variable: string, optional: true): Promise<number[] | null>;

    public getNumberList(variable: string, optional?: boolean): Promise<number[] | null>;

    public getNumberList(variable: string, optional = false): Promise<number[] | null> {
        return this.getValidatedList(
            variable,
            (value): value is number => typeof value === 'number',
            optional,
            ['number'],
        );
    }

    public getBooleanList(variable: string, optional?: false): Promise<boolean[]>;

    public getBooleanList(variable: string, optional: true): Promise<boolean[] | null>;

    public getBooleanList(variable: string, optional?: boolean): Promise<boolean[] | null>;

    public getBooleanList(variable: string, optional = false): Promise<boolean[] | null> {
        return this.getValidatedList(
            variable,
            (value): value is boolean => typeof value === 'boolean',
            optional,
            ['boolean'],
        );
    }

    private getValidatedList<T>(
        variable: string,
        guard: TypeValidator<T>,
        optional: boolean,
        types: string[],
    ): Promise<T[]>;

    private getValidatedList<T>(
        variable: string,
        guard: TypeValidator<T>,
        optional: boolean,
        types: string[],
    ): Promise<T[] | null>;

    private getValidatedList<T>(
        variable: string,
        guard: TypeValidator<T>,
        optional: boolean,
        types: string[],
    ): Promise<T[] | null>;

    private async getValidatedList<T>(
        variable: string,
        validator: TypeValidator<T>,
        optional: boolean,
        types: string[],
    ): Promise<T[] | null> {
        const value = await this.getList(variable, optional);

        if (value === null) {
            if (optional) {
                return null;
            }

            throw new ActionError(`Variable \`${variable}\` is not defined.`, {
                code: CliErrorCode.INVALID_INPUT,
            });
        }

        const list: T[] = [];

        for (const item of value) {
            if (!validator(item)) {
                throw new ActionError(
                    `Expected variable \`${variable}\` to be a list of ${types.join(' or ')}, `
                     + `but got ${ActionContext.getType(item)}.`,
                    {
                        code: CliErrorCode.INVALID_INPUT,
                    },
                );
            }

            list.push(item);
        }

        return list;
    }

    private static getType(value: unknown): string {
        return Array.isArray(value) ? 'array' : typeof value;
    }
}
