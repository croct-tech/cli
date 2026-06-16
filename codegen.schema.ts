import type {CodegenConfig} from '@graphql-codegen/cli';

const config: CodegenConfig = {
    schema: 'https://app.croct.com/graphql',
    generates: {
        './schema.graphql': {
            plugins: ['schema-ast'],
        },
    },
};

// eslint-disable-next-line import-x/no-default-export -- Must be default export
export default config;
