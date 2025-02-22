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

export type PasswordResetRequest = {
    email: string,
    sessionId: string,
};

export type PasswordReset = {
    token: string,
    password: string,
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

type SessionStateMap = {
    awaiting: Record<never, never>,
    'access-granted': {
        accessToken: string,
    },
    'recovery-granted': {
        recoveryToken: string,
    },
};

export type SessionStatus = keyof SessionStateMap;

export type SessionState<T extends SessionStatus = SessionStatus> = {
    [K in T]: {status: K} & SessionStateMap[K];
}[T];

export interface UserApi {
    getUser(): Promise<User>;

    isEmailRegistered(email: string): Promise<boolean>;

    requestPasswordReset(reset: PasswordResetRequest): Promise<void>;

    resetPassword(reset: PasswordReset): Promise<string>;

    registerUser(user: NewUser): Promise<void>;

    signIn(request: TokenRequest): Promise<string>;

    issueToken(options: TokenOptions): Promise<string>;

    retryActivation(retry: ActivationRetry): Promise<void>;

    createSession(session?: NewSession): Promise<string>;

    closeSession(sessionId: string): Promise<SessionState>;

    getOrganizations(): Promise<Organization[]>;

    getOrganization(organizationSlug: string): Promise<Organization | null>;

    setupOrganization(organization: OrganizationSetup): Promise<Organization>;

    getInvitations(): Promise<Invitation[]>;

    acceptInvitation(invitationId: string): Promise<void>;
}
