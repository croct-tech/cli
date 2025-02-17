import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {UserApi} from '@/application/api/user';

export type Configuration = {
    input: Input,
    output: Output,
    userApi: UserApi,
};

export type InvitationOptions = Record<never, never>;

export class InvitationForm implements Form<void, InvitationOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(): Promise<void> {
        const {input, output, userApi} = this.config;

        const invitations = await userApi.getInvitations();

        if (invitations.length === 0) {
            return;
        }

        if (invitations.length === 1) {
            const {id, organization} = invitations[0];

            if (
                await input.confirm({
                    message: `${organization.name} has invited you to join. Accept?`,
                    default: true,
                })
            ) {
                await userApi.acceptInvitation(id);
            }

            return;
        }

        if (invitations.length > 1) {
            output.inform(`You have ${invitations.length} pending invitations:`);
        }

        for (const {id, organization} of invitations) {
            if (
                await input.confirm({
                    message: `Accept invitation to join ${organization.name}?`,
                    default: true,
                })
            ) {
                await userApi.acceptInvitation(id);
            }
        }
    }
}
