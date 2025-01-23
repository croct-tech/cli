import {Action, ActionError, ActionOptions} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {Validator} from '@/application/validation';
import {ErrorReason} from '@/application/error';

export type Configuration<T extends ActionOptions> = {
    action: Action<T>,
    validator: Validator<T>,
};

export class ValidatedAction<T extends ActionOptions> implements Action {
    private readonly configuration: Configuration<T>;

    public constructor(configuration: Configuration<T>) {
        this.configuration = configuration;
    }

    public async execute(options: ActionOptions, context: ActionContext): Promise<void> {
        const {action, validator} = this.configuration;
        const validation = validator.validate(options);

        if (!validation.valid) {
            const violations = validation.violations
                .map(violation => ` • ${violation.path}: ${violation.message}`)
                .join('\n');

            throw new ActionError(`Invalid action options:\n\n${violations}`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        await action.execute(validation.data, context);
    }
}
