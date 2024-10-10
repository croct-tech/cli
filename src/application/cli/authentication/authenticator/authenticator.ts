import {Token} from '@/application/cli/authentication/authentication';

export interface TokenProvider {
    getToken(): Promise<Token | null>;
}

export interface Authenticator extends TokenProvider {
    login(): Promise<Token>;
    logout(): Promise<void>;
}
