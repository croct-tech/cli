import { defineConfig } from 'eslint/config';
import { configs } from '@croct/eslint-plugin';

export default defineConfig(
    configs.typescript,
    {
        ignores: [
            'build/**',
            'node_modules/**',
            'src/infrastructure/graphql/schema',
            'test/application/project/code/transformation/fixtures',
        ],
    },
    {
        rules: {
            'import/extensions': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/prefer-optional-chain': 'off',
            'import-x/extensions': 'off',
            '@typescript-eslint/await-thenable': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            '@typescript-eslint/strict-boolean-expressions': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
        },
    },
    {
        files: ['tsup.config.ts'],
        rules: {
            'import/no-default-export': 'off',
            'import-x/no-default-export': 'off',
            'object-shorthand': 'off',
            'func-names': 'off',
        },
    }
);