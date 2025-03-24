import {JsonValue} from '@croct/json';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';

export type Configuration = {
    input?: Input,
    output: Output,
    baseUrl: URL,
};

export class ActionContext {
    public readonly input?: Input;

    public readonly output: Output;

    public readonly baseUrl: URL;

    private readonly variables: Record<string, JsonValue> = {};

    public constructor(config: Configuration) {
        this.input = config.input;
        this.output = config.output;
        this.baseUrl = config.baseUrl;
    }

    public getVariables(): Record<string, JsonValue> {
        return structuredClone(this.variables);
    }

    public set(variable: string, value: JsonValue): void {
        this.variables[variable] = value;
    }
}
