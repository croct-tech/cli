import {User} from '@/application/model/user';
import {Organization} from '@/application/model/organization';

export type OrganizationSetup = {
    website: string,
    locale: string,
    timeZone: string,
    redirectUrl?: string,
    email?: string,
};

export type UserCredentials = {
    email: string,
    password: string,
};

export type PasswordReset = {
    email: string,
    sessionId: string,
};

export type ActivationRetry = {
    email: string,
    sessionId: string,
};

export type NewUser = Omit<User, 'id' | 'username'> & {
    password: string,
    sessionId?: string,
};

export interface UserApi {
    getUser(): Promise<User>;

    isEmailRegistered(email: string): Promise<boolean>;

    resetPassword(reset: PasswordReset): Promise<void>;

    registerUser(user: NewUser): Promise<void>;

    issueToken(credentials: UserCredentials): Promise<string>;

    retryActivation(retry: ActivationRetry): Promise<void>;

    createSession(): Promise<string>;

    getOrganizations(): Promise<Organization[]>;

    getOrganization(organizationSlug: string): Promise<Organization|null>;

    setupOrganization(organization: OrganizationSetup): Promise<Organization>;
}
