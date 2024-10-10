export type Token = string;

export interface AuthenticationListener {
    wait(sessionId: string): Promise<Token>;
}
