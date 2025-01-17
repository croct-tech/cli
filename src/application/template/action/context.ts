import {JsonArray, JsonObject, JsonPrimitive} from '@croct/json';
import {JsonPointer, JsonPointerLike} from '@croct/json-pointer';
import isPlainObject from 'is-plain-obj';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {ActionError} from '@/application/template/action/action';

import {ErrorReason} from '@/application/error';

export type LazyJsonValue = () => Promise<VariableValue>;

type VariableMap = {
    [key: string]: VariableValue,
};

export type VariableValue = JsonPrimitive | JsonArray | JsonObject | LazyJsonValue | VariableMap;

export type Configuration = {
    input?: Input,
    output: Output,
    variables?: VariableMap,
    baseUrl: URL,
};

type TypeValidator<T> = (value: unknown) => value is T;

export class ActionContext {
    public readonly input?: Input;

    public readonly output?: Output;

    private readonly baseUrl: URL;

    private variables: VariableMap;

    public constructor(config: Configuration) {
        this.input = config.input;
        this.output = config.output;
        this.baseUrl = config.baseUrl;
        this.variables = config.variables ?? {};
    }

    public getBaseUrl(): URL {
        return this.baseUrl;
    }

    public getVariables(): VariableMap {
        return this.variables;
    }

    public set(variable: JsonPointerLike, value: VariableValue|LazyJsonValue): void {
        const pointer = JsonPointer.from(variable);

        if (pointer.isRoot()) {
            throw new ActionError('Cannot set the root value.', {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        const parent = pointer.getParent();

        if (parent.has(this.variables)) {
            const parentValue = parent.get(this.variables);

            if (typeof parentValue !== 'object' || parentValue === null || Object.isFrozen(parentValue)) {
                throw new ActionError(
                    `Cannot set variable \`${variable}\` because the parent value is not writable.`,
                    {
                        reason: ErrorReason.INVALID_INPUT,
                    },
                );
            }
        } else {
            throw new ActionError(`Path \`${parent.toString()}\` does not exist.`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        pointer.set(this.variables, value);
    }

    public async resolveValue(reference: string): Promise<VariableValue> {
        const fullMatch = /\{\{(.*?)}}/.exec(reference);

        if (fullMatch !== null && fullMatch[0] === reference) {
            const variable = fullMatch[1].trim();

            return this.get(variable);
        }

        const regex = /\{\{(.*?)}}/g;
        const promises: Record<string, Promise<VariableValue>> = {};

        for (const match of reference.matchAll(regex)) {
            const variable = match[1].trim();

            promises[variable] = this.get(variable);
        }

        const replacements = Object.fromEntries(
            await Promise.all(
                Object.entries(promises).map(async ([variable, promise]) => [variable, await promise]),
            ),
        );

        return reference.replace(regex, (_, placeholder) => {
            const variable = placeholder.trim();
            const placeholderValue = replacements[variable];

            if (placeholderValue !== null && !['string', 'number', 'boolean'].includes(typeof placeholderValue)) {
                throw new ActionError(
                    `Expected placeholder variable \`${variable}\` to be null, string, number, or boolean, `
                    + `but got ${ActionContext.getType(placeholderValue)}.`,
                    {
                        reason: ErrorReason.INVALID_INPUT,
                    },
                );
            }

            return `${placeholderValue ?? ''}`;
        });
    }

    private async resolveValidatedValue<T>(
        reference: string,
        validator: TypeValidator<T>,
        types: string[],
    ): Promise<T> {
        const value = await this.resolveValue(reference);

        if (!validator(value)) {
            throw new ActionError(
                `Expected reference \`${reference}\` to be of type ${types.join(' or ')}, `
                + `but got ${ActionContext.getType(value)}.`,
                {
                    reason: ErrorReason.INVALID_INPUT,
                },
            );
        }

        return value;
    }

    public resolveString<T>(value: T): Promise<T> {
        if (typeof value === 'string') {
            return this.resolveValidatedValue<T>(
                value,
                (result): result is T => typeof result === 'string',
                ['string'],
            );
        }

        if (Array.isArray(value)) {
            return Promise.all(value.map(item => this.resolveString(item))) as Promise<T>;
        }

        if (isPlainObject(value)) {
            const promises: Array<Promise<[any, any]>> = [];

            for (const [key, item] of Object.entries(value)) {
                promises.push(Promise.all([
                    typeof key === 'string' ? this.resolveString(key) : key,
                    this.resolveString(item),
                ]));
            }

            return Promise.all(promises).then(Object.fromEntries) as Promise<T>;
        }

        return Promise.resolve(value);
    }

    public resolveNumber(reference: string): Promise<number> {
        return this.resolveValidatedValue(
            reference,
            (value): value is number => typeof value === 'number',
            ['number'],
        );
    }

    public resolveBoolean(reference: string): Promise<boolean> {
        return this.resolveValidatedValue(
            reference,
            (value): value is boolean => typeof value === 'boolean',
            ['boolean'],
        );
    }

    private async resolveList<T>(reference: string, validator: TypeValidator<T>, types: string[]): Promise<T[]> {
        const value = await this.resolveValue(reference);

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
                        reason: ErrorReason.INVALID_INPUT,
                    },
                );
            }

            list.push(item);
        }

        return list;
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

    public get(variable: JsonPointerLike, optional?: false): Promise<Exclude<VariableValue, null>>;

    public get(variable: JsonPointerLike, optional: true): Promise<VariableValue>;

    public get(variable: JsonPointerLike, optional?: boolean): Promise<VariableValue>;

    public async get(variable: JsonPointerLike, optional: boolean = false): Promise<VariableValue> {
        const pointer = JsonPointer.from(variable);

        if (pointer.isRoot()) {
            throw new ActionError('Cannot get the root value.', {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        let value = pointer.get(this.variables) ?? null;

        if (typeof value === 'function') {
            value = await value();

            this.replaceValue(pointer, value);
        }

        if (value === null && !optional) {
            throw new ActionError(`Variable \`${value}\` is not defined.`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        return value;
    }

    private async getValidatedValue<T>(
        variable: string,
        validator: TypeValidator<T>,
        types: string[],
    ): Promise<T | null> {
        const optional = types.includes('null');
        const value = await this.get(variable, optional);

        if (value === null) {
            if (optional) {
                return null;
            }

            throw new ActionError(`Variable \`${variable}\` is not defined.`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        if (!validator(value)) {
            throw new ActionError(
                `Expected variable \`${variable}\` to be of type ${types.join(' or ')}, `
                + `but got ${ActionContext.getType(value)}.`,
                {
                    reason: ErrorReason.INVALID_INPUT,
                },
            );
        }

        return value;
    }

    private replaceValue(pointer: JsonPointer, value: VariableValue): void {
        let parentPointer = pointer;
        const stack: Array<[JsonPointer, VariableValue|undefined]> = [];

        while (!parentPointer.isRoot()) {
            parentPointer = parentPointer.getParent();
            const parentValue = parentPointer.get(this.variables);

            if (!Object.isFrozen(parentValue)) {
                break;
            }

            stack.unshift([parentPointer, parentValue]);
        }

        for (const [index, [currentPointer, currentValue]] of stack.entries()) {
            if (currentPointer.isRoot()) {
                this.variables = {...this.variables};

                continue;
            }

            if (typeof currentValue === 'object' && currentValue !== null) {
                const copy = Array.isArray(currentValue) ? [...currentValue] : {...currentValue};

                currentPointer.set(this.variables, copy);

                stack[index][1] = copy;
            }
        }

        pointer.set(this.variables, value);

        for (const [, currentValue] of stack) {
            if (typeof currentValue === 'object' && currentValue !== null) {
                Object.freeze(currentValue);
            }
        }
    }

    public getString(variable: string, optional?: false): Promise<string>;

    public getString(variable: string, optional: true): Promise<string | null>;

    public getString(variable: string, optional?: boolean): Promise<string | null>;

    public getString(variable: string, optional = false): Promise<string | null> {
        return this.getValidatedValue(
            variable,
            (value): value is string => typeof value === 'string',
            optional ? ['string', 'null'] : ['string'],
        );
    }

    public getNumber(variable: string, optional?: false): Promise<number>;

    public getNumber(variable: string, optional: true): Promise<number | null>;

    public getNumber(variable: string, optional?: boolean): Promise<number | null>;

    public getNumber(variable: string, optional = false): Promise<number | null> {
        return this.getValidatedValue(
            variable,
            (value): value is number => typeof value === 'number',
            optional ? ['number', 'null'] : ['number'],
        );
    }

    public getBoolean(variable: string, optional?: false): Promise<boolean>;

    public getBoolean(variable: string, optional: true): Promise<boolean | null>;

    public getBoolean(variable: string, optional?: boolean): Promise<boolean | null>;

    public getBoolean(variable: string, optional = false): Promise<boolean | null> {
        return this.getValidatedValue(
            variable,
            (value): value is boolean => typeof value === 'boolean',
            optional ? ['boolean', 'null'] : ['boolean'],
        );
    }

    public getList(variable: string, optional?: false): Promise<JsonArray>;

    public getList(variable: string, optional: true): Promise<JsonArray|null>;

    public getList(variable: string, optional?: boolean): Promise<JsonArray|null>;

    public async getList(variable: string, optional = false): Promise<JsonArray|null> {
        const value = await this.get(variable, optional);

        if (value === null) {
            return value;
        }

        if (!Array.isArray(value)) {
            throw new ActionError(
                `Expected variable \`${variable}\` to be a list, `
                + `but got ${ActionContext.getType(value)}.`,
                {
                    reason: ErrorReason.INVALID_INPUT,
                },
            );
        }

        return value;
    }

    private async getValidatedList<T>(
        variable: string,
        validator: TypeValidator<T>,
        optional: boolean,
        types: string[],
    ): Promise<T[] | null> {
        const value = await this.getList(variable, optional);

        if (value === null) {
            return value;
        }

        const list: T[] = [];

        for (const item of value) {
            if (!validator(item)) {
                throw new ActionError(
                    `Expected variable \`${variable}\` to be a list of ${types.join(' or ')}, `
                    + `but got ${ActionContext.getType(item)}.`,
                    {
                        reason: ErrorReason.INVALID_INPUT,
                    },
                );
            }

            list.push(item);
        }

        return list;
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

    private static getType(value: unknown): string {
        return Array.isArray(value) ? 'array' : typeof value;
    }
}
