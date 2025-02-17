import {Authenticator} from '@/application/cli/authentication/authenticator/authenticator';

type AuthenticationInputs = Record<string, Record<string, any>>;

export type AuthenticatorMap<M extends AuthenticationInputs> = {
    [K in keyof M]: Authenticator<M[K]>;
};

export type MultiAuthenticationInput<M extends AuthenticationInputs, K extends keyof M = keyof M> = {
    [T in K]: M[T] & {
        method: T,
    }
}[K];

export class MultiAuthenticator<T extends AuthenticationInputs> implements Authenticator<MultiAuthenticationInput<T>> {
    private readonly authenticators: AuthenticatorMap<T>;

    public constructor(authenticators: AuthenticatorMap<T>) {
        this.authenticators = authenticators;
    }

    public async getToken(): Promise<string|null> {
        for (const authenticator of Object.values(this.authenticators)) {
            const token = await authenticator.getToken();

            if (token !== null) {
                return token;
            }
        }

        return null;
    }

    public login<K extends keyof T>(input: MultiAuthenticationInput<T, K>): Promise<string> {
        const props: T[K] = {...input};

        delete props.method;

        return this.authenticators[input.method].login(props);
    }

    public async logout(): Promise<void> {
        await Promise.all(Object.values(this.authenticators).map(authenticator => authenticator.logout()));
    }
}
