import {GraphqlClient} from '@/infrastructure/graphql';
import {
    ActivationRetry,
    TokenRequest,
    NewUser,
    OrganizationSetup,
    PasswordReset,
    UserApi,
    Invitation,
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
import {
    organizationQuery,
    organizationSlugQuery,
    organizationsQuery,
    setupOrganizationMutation,
    websiteMetadataQuery,
} from '@/infrastructure/application/api/graphql/queries/organization';
import {
    acceptInvitationMutation,
    invitationQuery,
    userEmailQuery,
    usernameQuery,
    userQuery,
} from '@/infrastructure/application/api/graphql/queries/user';
import {
    createSession,
    issueTokenMutation,
    retryActivationMutation,
    sendResetLink,
    signInMutation,
    signUpMutation,
} from '@/infrastructure/application/api/graphql/queries/auth';
import {User} from '@/application/model/user';
import {Organization} from '@/application/model/organization';

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
                bypassOnboarding: true,
            },
        });
    }

    public async createSession(): Promise<string> {
        const {data} = await this.client.execute(createSession);

        return data.createSession;
    }

    public async signIn(request: TokenRequest): Promise<string> {
        const {data} = await this.client.execute(signInMutation, {
            payload: {
                email: request.email,
                password: request.password,
                duration: request.duration,
                // @todo remove this
                remember: false,
            },
        });

        return data.signIn.token!;
    }

    public async issueToken(options: TokenRequest): Promise<string> {
        const {data} = await this.client.execute(issueTokenMutation, {
            payload: {
                duration: options.duration,
            },
        });

        return data.issueToken;
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

        if (website.hostname.toLowerCase() === 'localhost') {
            return {
                locale: setup.locale,
                timeZone: setup.timeZone,
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
                name: metadata.siteName,
                slug: await this.generateOrganizationSlug(metadata.siteName, false),
                type: OrganizationType.Business,
                logo: logo,
            },
            workspace: {
                name: metadata.siteName,
                slug: generateSlug({baseName: metadata.siteName, alwaysSuffixed: false}).next().value,
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

    public async getInvitations(): Promise<Invitation[]> {
        const {data} = await this.client.execute(invitationQuery);
        const edges = data.invitations.edges ?? [];

        return edges.flatMap((edge): Invitation[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [{
                id: node.id,
                invitationTime: node.invitationTime,
                organization: GraphqlUserApi.normalizeOrganization(node.organization),
            }];
        });
    }

    public async acceptInvitation(invitationId: string): Promise<void> {
        await this.client.execute(acceptInvitationMutation, {
            invitationId: invitationId,
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
