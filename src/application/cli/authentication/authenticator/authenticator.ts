import {Token} from '@/application/cli/authentication/authentication';

export interface TokenProvider {
    getToken(): Promise<Token | null>;
}

export type AuthenticationInput = Record<string, any>;

export interface Authenticator<I extends AuthenticationInput> extends TokenProvider {
    login(input: I): Promise<Token>;
    logout(): Promise<void>;
}
