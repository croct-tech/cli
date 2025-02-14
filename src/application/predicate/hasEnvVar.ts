import {Predicate} from '@/application/predicate/predicate';
import {Process} from '@/application/system/process/process';

export type Configuration = {
    process: Process,
    variable: string,
    value?: RegExp,
};

export class HasEnvVar implements Predicate {
    private readonly process: Process;

    private readonly variable: string;

    private readonly value?: RegExp;

    public constructor(configuration: Configuration) {
        this.process = configuration.process;
        this.variable = configuration.variable;
        this.value = configuration.value;
    }

    public test(): boolean {
        const value = this.process.getEnvValue(this.variable);

        if (value === null) {
            return false;
        }

        return this.value?.test(value) === true;
    }
}
