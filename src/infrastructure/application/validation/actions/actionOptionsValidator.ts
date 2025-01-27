import {
    ZodArray,
    ZodDiscriminatedUnion,
    ZodEffects,
    ZodObject,
    ZodOptional,
    ZodPromise,
    ZodRecord,
    ZodTuple,
    ZodTypeAny,
    ZodUnion,
} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {ActionOptions} from '@/application/template/action/action';
import {ValidationResult} from '@/application/validation';
import {TemplateError} from '@/application/template/provider/templateProvider';

type Segment = string | number | symbol;
type Path = Segment[];

const ANY = Symbol('any');
const PASSTHROUGH = Symbol('passthrough');
const RESOLVE = Symbol('resolve');

export class ActionOptionsValidator<T extends ActionOptions> extends ZodValidator<T> {
    public async validate(data: unknown): Promise<ValidationResult<T>> {
        const passthroughPaths = this.findPassthroughPaths(this.schema);

        let options: unknown;

        try {
            options = await this.resolveOptions(data, passthroughPaths);
        } catch (error) {
            if (error instanceof TemplateError) {
                return {
                    valid: false,
                    violations: error.violations,
                };
            }

            throw error;
        }

        return super.validate(options);
    }

    private async resolveOptions(data: unknown, passthroughPaths: Path[], path: Path = []): Promise<unknown> {
        if (data instanceof Promise && !ActionOptionsValidator.isPassthroughPath(path, passthroughPaths)) {
            return this.resolveOptions(await data, passthroughPaths, path);
        }

        if (typeof data !== 'object' || data === null || data instanceof Promise) {
            return data;
        }

        if (Array.isArray(data)) {
            const promises = new Array(data.length);
            const result = new Array(data.length);

            for (const [index, item] of data.entries()) {
                const subPath = [...path, index];

                if (item instanceof Promise && ActionOptionsValidator.isPassthroughPath(subPath, passthroughPaths)) {
                    result[index] = item;
                } else {
                    promises[index] = this.resolveOptions(await item, passthroughPaths, subPath);
                }
            }

            for (const [index, value] of (await Promise.all(promises)).entries()) {
                if (value !== undefined) {
                    result[index] = value;
                }
            }

            return result;
        }

        return {
            ...data,
            ...Object.fromEntries(
                await Promise.all(
                    Object.entries(data).map(
                        async ([key, value]) => {
                            const subPath = [...path, key];

                            if (
                                value instanceof Promise
                                && ActionOptionsValidator.isPassthroughPath(subPath, passthroughPaths)
                            ) {
                                return [key, value];
                            }

                            return [key, await this.resolveOptions(await value, passthroughPaths, subPath)];
                        },
                    ),
                ),
            ),
        };
    }

    private static isPassthroughPath(path: Path, passthroughPaths: Path[]): boolean {
        for (const passthroughPath of passthroughPaths) {
            if (passthroughPath.length !== path.length + 1) {
                continue;
            }

            for (const [index, segment] of passthroughPath.entries()) {
                if (
                    index < path.length
                        ? (segment !== path[index] && segment !== ANY)
                        : (segment !== RESOLVE && segment !== PASSTHROUGH)
                ) {
                    break;
                }

                if (index === passthroughPath.length - 1) {
                    return segment === PASSTHROUGH;
                }
            }
        }

        return false;
    }

    private findPassthroughPaths(schema: ZodTypeAny, path: Path = []): Path[] {
        if (schema instanceof ZodPromise) {
            return [[...path, PASSTHROUGH]];
        }

        if (schema instanceof ZodOptional) {
            return this.findPassthroughPaths(schema.unwrap(), path);
        }

        if (schema instanceof ZodTuple) {
            return [
                [...path, RESOLVE],
                ...schema.items.flatMap(
                    (itemSchema: ZodTypeAny, index: number) => this.findPassthroughPaths(itemSchema, [...path, index]),
                ),
            ];
        }

        if (schema instanceof ZodArray) {
            return [
                [...path, RESOLVE],
                ...this.findPassthroughPaths(schema.element, [...path, ANY]),
            ];
        }

        if (schema instanceof ZodRecord) {
            return [
                [...path, RESOLVE],
                ...this.findPassthroughPaths(schema.valueSchema, [...path, ANY]),
            ];
        }

        if (schema instanceof ZodObject) {
            const paths = [
                [...path, RESOLVE],
                ...Object.entries<ZodTypeAny>(schema.shape).flatMap(
                    ([key, propertySchema]) => this.findPassthroughPaths(propertySchema, [...path, key]),
                ),
            ];

            if (schema._def.unknownKeys === 'passthrough') {
                paths.push([...path, ANY, PASSTHROUGH]);
            }

            return paths;
        }

        if (schema instanceof ZodEffects) {
            return this.findPassthroughPaths(schema.innerType(), path);
        }

        if (schema instanceof ZodUnion || schema instanceof ZodDiscriminatedUnion) {
            // Caveat: When multiple schemas in a union use the same property name but only some are promises,
            // they cannot be distinguished. As a result, they are either be resolved or passed through based on
            // which one is declared first in the union.
            return schema.options.flatMap((subSchema: ZodTypeAny) => this.findPassthroughPaths(subSchema, path));
        }

        return [[...path, RESOLVE]];
    }
}
