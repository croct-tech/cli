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

export const sendResetLink = graphql(`
    mutation SendResetLink($email: String!, $sessionId: String) {
        sendResetLink(email: $email, sessionId: $sessionId)
    }
`);

export const resetPassword = graphql(`
    mutation ResetPassword($payload: ResetPasswordPayload!) {
        resetPassword(payload: $payload) {
            token
        }
    }
`);

export const retryActivationMutation = graphql(`
    mutation RetryActivation($email: String!, $sessionId: String!) {
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
    mutation CloseSession($sessionId: String!) {
        closeSession(sessionId: $sessionId) {
            __typename
            ... on CloseSessionRecoveryResult {
                recoveryToken
            }
            ... on CloseSessionAuthenticatedResult {
                accessToken
            }
        }
    }
`);
