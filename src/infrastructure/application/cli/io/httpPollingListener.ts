import {AuthenticationListener} from '@/application/cli/authentication/authentication';

export type Configuration = {
    endpoint: string,
    parameter: string,
    pollingInterval: number,
};

export class HttpPollingListener implements AuthenticationListener {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public wait(sessionId: string): Promise<string> {
        const endpoint = new URL(this.config.endpoint);

        endpoint.searchParams.set(this.config.parameter, sessionId);

        return this.poll(endpoint);
    }

    private async poll(endpoint: URL): Promise<string> {
        // eslint-disable-next-line no-constant-condition -- Intentional infinite loop
        while (true) {
            try {
                const response = await fetch(endpoint);

                if (response.ok) {
                    const body = await response.json() as {token?: string};

                    if (body.token !== undefined) {
                        return body.token;
                    }
                }
            } catch {
                // Ignore
            }

            await new Promise(resolve => {
                setTimeout(resolve, this.config.pollingInterval);
            });
        }
    }
}
