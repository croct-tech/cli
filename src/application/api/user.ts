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

export type TokenOptions = {
    duration: number,
};

export type TokenRequest = TokenOptions & UserCredentials;

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

export type Invitation = {
    id: string,
    invitationTime: number,
    organization: Organization,
};

export type NewSession = {
    destination?: string,
};

export interface UserApi {
    getUser(): Promise<User>;

    isEmailRegistered(email: string): Promise<boolean>;

    resetPassword(reset: PasswordReset): Promise<void>;

    registerUser(user: NewUser): Promise<void>;

    signIn(request: TokenRequest): Promise<string>;

    issueToken(options: TokenOptions): Promise<string>;

    retryActivation(retry: ActivationRetry): Promise<void>;

    createSession(session?: NewSession): Promise<string>;

    getOrganizations(): Promise<Organization[]>;

    getOrganization(organizationSlug: string): Promise<Organization|null>;

    setupOrganization(organization: OrganizationSetup): Promise<Organization>;

    getInvitations(): Promise<Invitation[]>;

    acceptInvitation(invitationId: string): Promise<void>;
}
