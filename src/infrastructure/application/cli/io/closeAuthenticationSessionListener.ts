import type {UserApi} from '../../../../application/api/user';
import type {AuthenticationListener} from '../../../../application/cli/authentication';

export type Configuration = {
    api: UserApi,
    pollingInterval: number,
};

export class CloseAuthenticationSessionListener implements AuthenticationListener {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async wait(sessionId: string): Promise<string> {
        // eslint-disable-next-line no-constant-condition -- Intentional infinite loop
        while (true) {
            const result = await this.config
                .api
                .closeSession(sessionId);

            if (result.outcome === 'authenticated') {
                return result.accessToken;
            }

            if (result.outcome !== 'incomplete') {
                throw new Error('Session ended without authenticating a user');
            }

            await new Promise(resolve => {
                setTimeout(resolve, this.config.pollingInterval);
            });
        }
    }
}
