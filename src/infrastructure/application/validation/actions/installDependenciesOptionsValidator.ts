import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {InstallDependenciesOptions} from '@/application/template/action/installDependenciesAction';

const schema: ZodType<InstallDependenciesOptions> = z.strictObject({});

export class InstallDependenciesOptionsValidator extends ActionOptionsValidator<InstallDependenciesOptions> {
    public constructor() {
        super(schema);
    }
}
