import {AuthenticationListener} from '@/application/cli/authentication';
import {UserApi} from '@/application/api/user';

export type Configuration = {
    api: UserApi,
    pollingInterval: number,
};

export class SessionCloseListener implements AuthenticationListener {
    private readonly api: UserApi;

    private readonly pollingInterval: number;

    public constructor(config: Configuration) {
        this.api = config.api;
        this.pollingInterval = config.pollingInterval;
    }

    public async wait(sessionId: string): Promise<string> {
        let state = await this.api.closeSession(sessionId);

        while (state.status === 'pending') {
            await this.delay();

            state = await this.api.closeSession(sessionId);
        }

        switch (state.status) {
            case 'access-granted':
                return state.accessToken;

            case 'recovery-granted':
                return state.recoveryToken;
        }
    }

    private delay(): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, this.pollingInterval);
        });
    }
}
