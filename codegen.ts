import {CodegenConfig} from '@graphql-codegen/cli';

const config: CodegenConfig = {
    schema: './schema.graphql',
    documents: ['src/**/*.ts'],
    ignoreNoDocuments: true,
    generates: {
        './src/infrastructure/graphql/schema/': {
            preset: 'client',
            config: {
                documentMode: 'string',
                scalars: {
                    ReadableId: 'string',
                    UserId: 'string',
                    InviteId: 'string',
                    PublicId: 'string',
                    Instant: 'number',
                    ImageData: 'string',
                    DashboardId: 'string',
                    SlotId: 'string',
                    AudienceId: 'string',
                    QueryId: 'string',
                    LocalDateTime: 'string',
                    StringMap: 'Record<string, string>',
                    ContentDefinition: 'Record<string, any>',
                    JsonSchema: 'Record<string, any>',
                    JSONObject: 'Record<string, any>',
                    TimeZone: 'string',
                    LocalDate: 'string',
                    ExperienceRevisionId: 'string',
                },
            },
        },
    },
};

export default config;
