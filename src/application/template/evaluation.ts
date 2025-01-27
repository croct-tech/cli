import {JsonObject, JsonValue} from '@croct/json';
import {Help, HelpfulError} from '@/application/error';
import {Deferred, Deferrable} from '@/application/template/deferral';

export type VariableMap = Exclude<Deferrable<JsonObject>, Deferred<JsonObject>>;

export class EvaluationError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, EvaluationError.prototype);
    }
}

export type GenericFunction = (...args: JsonValue[]) => Deferred<JsonValue>;

export type EvaluationContext = {
    variables?: VariableMap,
    functions?: Record<string, GenericFunction>,
};

export interface ExpressionEvaluator {
    evaluate(expression: string, context?: EvaluationContext): Deferred<JsonValue>;
}
