import {graphql, GraphqlClient} from '@/infrastructure/graphql';
import {Organization, User} from '@/application/model/entities';
import {
    PasswordReset,
    NewUser,
    OrganizationSetup,
    UserApi,
    UserCredentials,
    ActivationRetry,
} from '@/application/api/user';
import {generateAvailableSlug} from '@/infrastructure/application/api/utils/generateAvailableSlug';
import {
    ApplicationEnvironment,
    OrganizationMetadataQuery,
    OrganizationQuery,
    OrganizationType,
    Platform,
    SetupOrganizationMutationVariables,
} from '@/infrastructure/graphql/schema/graphql';
import {generateSlug} from '@/infrastructure/application/api/utils/generateSlug';

type OrganizationSetupPayload = SetupOrganizationMutationVariables['payload'];

type WebsiteMetadata = OrganizationMetadataQuery['websiteMetadata'];

type OrganizationData = NonNullable<OrganizationQuery['organization']>;

export class GraphqlUserApi implements UserApi {
    private readonly client: GraphqlClient;

    public constructor(client: GraphqlClient) {
        this.client = client;
    }

    public async getUser(): Promise<User> {
        const {data} = await this.client.execute(userQuery);

        const {id, user} = data.userAccount;
        const {profile: {lastName = null}} = user;

        return {
            id: id,
            username: user.profile.firstName,
            email: user.email,
            firstName: user.profile.firstName,
            expertise: user.profile.expertise as any,
            ...(lastName !== null ? {lastName: lastName} : {}),
        };
    }

    public async isEmailRegistered(email: string): Promise<boolean> {
        const {data} = await this.client.execute(userEmailQuery, {email: email});

        return !data.checkAvailability.email;
    }

    public async resetPassword(reset: PasswordReset): Promise<void> {
        await this.client.execute(sendResetLink, {
            email: reset.email,
            sessionId: reset.sessionId,
        });
    }

    public async retryActivation(retry: ActivationRetry): Promise<void> {
        await this.client.execute(retryActivationMutation, {
            email: retry.email,
            sessionId: retry.sessionId,
        });
    }

    public async registerUser(user: NewUser): Promise<void> {
        await this.client.execute(signUpMutation, {
            payload: {
                username: await this.generateUsername(`${user.firstName} ${user.lastName ?? ''}`.trim()),
                email: user.email,
                password: user.password,
                firstName: user.firstName,
                lastName: user.lastName,
                expertise: user.expertise as any,
                sessionId: user.sessionId,
            },
        });
    }

    public async createSession(): Promise<string> {
        const {data} = await this.client.execute(createSession);

        return data.createSession;
    }

    public async issueToken(credentials: UserCredentials): Promise<string> {
        const {headers} = await this.client.execute(signInMutation, {
            payload: {
                email: credentials.email,
                password: credentials.password,
                remember: true,
            },
        });

        const cookie = headers.get('set-cookie') ?? '';

        const token = cookie.split(';')
            .find(part => part.startsWith('__croctApi='))
            ?.split('=')[1];

        if (token === undefined) {
            throw new Error('Token not found');
        }

        return token;
    }

    public async getOrganization(organizationSlug: string): Promise<Organization | null> {
        const {data} = await this.client.execute(organizationQuery, {
            slug: organizationSlug,
        });

        const organization = data.organization ?? null;

        if (organization === null) {
            return null;
        }

        return GraphqlUserApi.normalizeOrganization(organization);
    }

    public async getOrganizations(): Promise<Organization[]> {
        const {data} = await this.client.execute(organizationsQuery);

        const edges = data.organizations.edges ?? [];

        return edges.flatMap((edge): Organization[] => {
            const node = edge?.node ?? null;

            if (node === null || node.slug === 'demo') {
                return [];
            }

            return [GraphqlUserApi.normalizeOrganization(node)];
        });
    }

    private static normalizeOrganization(data: OrganizationData): Organization {
        const {logo = null, website = null} = data;

        return {
            id: data.id,
            name: data.name,
            slug: data.slug,
            type: data.type as any,
            email: data.email,
            ...(logo !== null ? {logo: logo} : {}),
            ...(website !== null ? {website: website} : {}),
        };
    }

    public async setupOrganization(setup: OrganizationSetup): Promise<Organization> {
        const {data} = await this.client.execute(setupOrganizationMutation, {
            payload: await this.getOrganizationSetupPayload(setup),
        });

        const {organization} = data.createConfiguredOrganization;
        const {logo = null, website = null} = organization;

        return {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            type: organization.type as any,
            email: organization.email,
            ...(logo !== null ? {logo: logo} : {}),
            ...(website !== null ? {website: website} : {}),
        };
    }

    private async getOrganizationSetupPayload(setup: OrganizationSetup): Promise<OrganizationSetupPayload> {
        const website = new URL(setup.website);
        const owner = await this.getUser();
        const name = `${owner.firstName} ${owner.lastName ?? ''}`.trim();

        if (website.origin.toLowerCase() === 'localhost') {
            return {
                locale: setup.locale,
                timeZone: setup.timeZone,
                email: owner.email,
                acceptedTerms: true,
                organization: {
                    website: website.origin,
                    email: owner.email,
                    name: 'Personal organization',
                    slug: await this.generateOrganizationSlug(name, true),
                    type: OrganizationType.Personal,
                },
                workspace: {
                    name: 'Personal workspace',
                    slug: generateSlug({baseName: name, alwaysSuffixed: true}).next().value,
                    website: website.origin,
                },
                applications: [{
                    environment: ApplicationEnvironment.Development,
                    name: 'Website',
                    slug: 'website-dev',
                    website: website.origin,
                    platform: Platform.Javascript,
                }],
                audiences: [],
                components: [],
                experiences: [],
                slots: [],
                redirectUrl: setup.redirectUrl,
            };
        }

        const metadata = await this.getOrganizationMetadata(website);
        const resolvedUrl = `${website.protocol}//${metadata.domain}`;
        const siteName = metadata.siteName.length < 2
            ? metadata.domain[0].toUpperCase() + metadata.domain.slice(1)
            : metadata.siteName.slice(0, 30);

        const logo = metadata.logo !== null && metadata.logo !== undefined
            && metadata.logo.width >= 64 && metadata.logo.height >= 64
            ? metadata.logo.data
            : undefined;

        return {
            locale: metadata.languages[0] ?? setup.locale,
            timeZone: setup.timeZone,
            acceptedTerms: true,
            organization: {
                website: resolvedUrl,
                email: owner.email,
                name: siteName,
                slug: await this.generateOrganizationSlug(siteName, false),
                type: OrganizationType.Business,
                logo: logo,
            },
            workspace: {
                name: siteName,
                slug: generateSlug({baseName: siteName, alwaysSuffixed: false}).next().value,
                logo: logo,
                website: resolvedUrl,
            },
            applications: [
                {
                    environment: ApplicationEnvironment.Production,
                    name: 'Website',
                    slug: 'website-prod',
                    website: website.origin,
                    platform: metadata.platform,
                }, {
                    environment: ApplicationEnvironment.Development,
                    name: 'Website',
                    slug: 'website-dev',
                    website: website.origin,
                    platform: metadata.platform,
                },
            ],
            audiences: [],
            components: [],
            experiences: [],
            slots: [],
            redirectUrl: setup.redirectUrl,
        };
    }

    private async getOrganizationMetadata(url: URL): Promise<WebsiteMetadata> {
        const {data} = await this.client.execute(websiteMetadataQuery, {
            url: url.toString(),
        });

        return data.websiteMetadata;
    }

    private generateOrganizationSlug(baseName: string, alwaysSuffixed = false): Promise<string> {
        return generateAvailableSlug({
            query: organizationSlugQuery,
            baseName: baseName,
            client: this.client,
            alwaysSuffixed: alwaysSuffixed,
        });
    }

    private generateUsername(name: string): Promise<string> {
        return generateAvailableSlug({
            query: usernameQuery,
            baseName: name,
            client: this.client,
            alwaysSuffixed: false,
        });
    }
}

const signInMutation = graphql(`
    mutation SignIn($payload: SignInPayload!) {
        signIn(payload: $payload) {
            id
        }
    }
`);

const createSession = graphql(`
    mutation CreateSession {
        createSession
    }
`);

const sendResetLink = graphql(`
    mutation SendResetLink($email: String!, $sessionId: String) {
        sendResetLink(email: $email, sessionId: $sessionId)
    }
`);

const retryActivationMutation = graphql(`
    mutation RetryActivation($email: String!, $sessionId: String!) {
        retry {
            accountActivation(sessionId: $sessionId, email: $email)
        }
    }
`);

const signUpMutation = graphql(`
    mutation SignUp($payload: SignUpPayload!) {
        signUp(payload: $payload) {
            userId
        }
    }
`);

const userQuery = graphql(`
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

const usernameQuery = graphql(`
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

const userEmailQuery = graphql(`
    query UserEmail($email: String!) {
        checkAvailability {
            email(email: $email)
        }
    }
`);

const organizationQuery = graphql(`
    query Organization($slug: ReadableId!) {
        organization(slug: $slug) {
            id
            name
            slug
            type
            website
            logo
            email
        }
    }
`);

const organizationsQuery = graphql(`
    query Organizations {
        organizations(first: 100) {
            edges {
                node {
                    id
                    name
                    slug
                    type
                    website
                    logo
                    email
                }
            }
        }
    }
`);

const websiteMetadataQuery = graphql(`
    query OrganizationMetadata($url: String!) {
        websiteMetadata(url: $url){
            url
            siteName
            domain
            languages
            platform
            technologies {
                name
            }
            logo {
                data
                height
                width
            }
        }
    }
`);

const setupOrganizationMutation = graphql(`
    mutation SetupOrganization($payload: CreateConfiguredOrganizationPayload!) {
        createConfiguredOrganization(payload: $payload) {
            organization {
                id
                name
                slug
                type
                website
                logo
                email
            }
        }
    }
`);

const organizationSlugQuery = graphql(`
    query FindOrganizationSlug(
        $slugFirstOption: ReadableId!
        $slugSecondOption: ReadableId!
        $slugThirdOption: ReadableId!
    ) {
        checkAvailability {
            slugFirstOption: organizationSlug(slug: $slugFirstOption)
            slugSecondOption: organizationSlug(slug: $slugSecondOption)
            slugThirdOption: organizationSlug(slug: $slugThirdOption)
        }
    }
`);
