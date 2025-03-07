import {graphql} from '@/infrastructure/graphql';

export const signInMutation = graphql(`
    mutation SignIn($payload: SignInPayload!) {
        signIn(payload: $payload) {
            token
        }
    }
`);

export const signUpMutation = graphql(`
    mutation SignUp($payload: SignUpPayload!) {
        signUp(payload: $payload) {
            userId
        }
    }
`);

export const issueTokenMutation = graphql(`
    mutation IssueToken($payload: IssueTokenPayload!) {
        issueToken(payload: $payload) 
    }
`);

export const resetPassword = graphql(`
    mutation ResetPassword($payload: ResetPasswordPayload!) {
        resetPassword(payload: $payload) {
            token
        }
    }
`);

export const requestPasswordReset = graphql(`
    mutation RequestPasswordReset($email: String!, $sessionId: UserSessionId) {
        sendResetLink(email: $email, sessionId: $sessionId)
    }
`);

export const retryActivationMutation = graphql(`
    mutation RetryActivation($email: String!, $sessionId: UserSessionId!) {
        retry {
            accountActivation(sessionId: $sessionId, email: $email)
        }
    }
`);

export const createSession = graphql(`
    mutation CreateSession($redirectDestination: String) {
        createSession(redirectDestination: $redirectDestination)
    }
`);

export const closeSession = graphql(`
    mutation CloseSession($sessionId: UserSessionId!) {
        closeSession(sessionId: $sessionId) {
            __typename
            ... on CloseSessionRecoveryGrantedResult {
                recoveryToken
            }
            ... on CloseSessionAccessGrantedResult {
                accessToken
            }
        }
    }
`);
