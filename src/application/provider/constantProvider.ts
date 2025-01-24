import {ResourceProvider} from '@/application/provider/resourceProvider';
import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';

export class ConstantProvider<T> implements ParameterlessProvider<T>, ResourceProvider<T> {
    private readonly data: T;

    public constructor(data: T) {
        this.data = data;
    }

    public supports(): boolean {
        return true;
    }

    public get(): Promise<T> {
        return Promise.resolve(this.data);
    }
}
