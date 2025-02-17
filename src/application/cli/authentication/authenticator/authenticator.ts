import {Help, HelpfulError} from '@/application/error';

export interface TokenProvider {
    getToken(): Promise<string | null>;
}

export type AuthenticationInput = Record<string, any>;

export class AuthenticationError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

export interface Authenticator<I extends AuthenticationInput> extends TokenProvider {
    login(input: I): Promise<string>;
    logout(): Promise<void>;
}
