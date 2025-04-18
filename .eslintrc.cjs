// Workaround for https://github.com/eslint/eslint/issues/3458
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
    extends: ['plugin:@croct/typescript'],
    plugins: ['@croct'],
    parserOptions: {
        project: ['**/tsconfig.json'],
    },
    ignorePatterns: [
        'src/infrastructure/graphql/schema',
        'test/application/project/code/transformation/fixtures',
    ],
    rules: {
        'import/extensions': 'off',
    },
    overrides: [
        {
            files: ['tsup.config.ts'],
            rules: {
                'import/no-default-export': 'off',
            },
        },
    ],
};
