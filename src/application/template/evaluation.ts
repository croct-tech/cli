import {JsonValue} from '@croct/json';
import {Help, HelpfulError} from '@/application/error';

export type LazyJsonValue = () => Promise<JsonValue>|JsonValue;

export type VariableMap = {
    [key: string]: VariableValue|undefined,
};

export type VariableValue = JsonValue | VariableMap | LazyJsonValue;

export class EvaluationError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, EvaluationError.prototype);
    }
}

export type GenericFunction = (...args: JsonValue[]) => Promise<JsonValue>|JsonValue;

export type EvaluationContext = {
    variables?: VariableMap,
    functions?: Record<string, GenericFunction>,
};

export interface ExpressionEvaluator {
    evaluate(expression: string, context?: EvaluationContext): Promise<JsonValue>;
}
