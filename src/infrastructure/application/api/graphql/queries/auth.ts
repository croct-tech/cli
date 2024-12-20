import {graphql} from '@/infrastructure/graphql';

export const signInMutation = graphql(`
    mutation SignIn($payload: SignInPayload!) {
        signIn(payload: $payload) {
            id
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

export const sendResetLink = graphql(`
    mutation SendResetLink($email: String!, $sessionId: String) {
        sendResetLink(email: $email, sessionId: $sessionId)
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
    mutation CreateSession {
        createSession
    }
`);
