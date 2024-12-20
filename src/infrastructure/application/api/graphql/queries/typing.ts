import {graphql} from '@/infrastructure/graphql';

export const generateTypingMutation = graphql(`
    mutation GenerateTyping($workspaceId: WorkspaceId!, $payload: GenerateTypingPayload!) {
        generateTyping(workspaceId: $workspaceId, payload: $payload)
    }
`);
