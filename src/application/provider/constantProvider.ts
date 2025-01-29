import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';

export class ConstantProvider<T> implements ParameterlessProvider<T> {
    private readonly data: T;

    public constructor(data: T) {
        this.data = data;
    }

    public get(): Promise<T> {
        return Promise.resolve(this.data);
    }
}
