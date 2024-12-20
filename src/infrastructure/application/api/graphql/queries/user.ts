import {graphql} from '@/infrastructure/graphql';

export const userQuery = graphql(`
    query User {
        userAccount {
            id
            user {
                username
                email
                profile {
                    firstName
                    lastName
                    expertise
                }
            }
        }
    }
`);

export const usernameQuery = graphql(`
    query Username(
        $slugFirstOption: ReadableId!
        $slugSecondOption: ReadableId!
        $slugThirdOption: ReadableId!
    ) {
        checkAvailability {
            slugFirstOption: username(username: $slugFirstOption)
            slugSecondOption: username(username: $slugSecondOption)
            slugThirdOption: username(username: $slugThirdOption)
        }
    }
`);

export const userEmailQuery = graphql(`
    query UserEmail($email: String!) {
        checkAvailability {
            email(email: $email)
        }
    }
`);
