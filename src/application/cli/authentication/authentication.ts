export interface AuthenticationListener {
    wait(sessionId: string): Promise<string>;
}
