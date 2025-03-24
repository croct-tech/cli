import {JsonArray, JsonObject, JsonPrimitive, JsonValue} from '@croct/json';

type MaybeDeferred<T> = T | Promise<T>;

type DeferredObject = MaybeDeferred<{
    [key: string]: MaybeDeferred<DeferredValue>|undefined,
    [key: symbol]: never|undefined,
}>;

type DeferredArray = MaybeDeferred<Array<MaybeDeferred<DeferredValue>>>;

type DeferredPrimitive = MaybeDeferred<JsonPrimitive>;

type DeferredValue = DeferredObject | DeferredArray | DeferredPrimitive;

export type Deferred<T extends JsonValue> = Promise<
    T extends JsonArray
        ? DeferredArray
        : T extends JsonObject
            ? DeferredObject
            : T extends JsonPrimitive
                ? DeferredPrimitive
                : DeferredValue
>;

export type Deferrable<T extends JsonValue> = Deferred<T> | Awaited<Deferred<T>>;
