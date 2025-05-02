import {NodeImportResolver} from '@/application/project/import/nodeImportResolver';
import {LocalFilesystem} from '@/application/fs/localFilesystem';
import {VirtualizedWorkingDirectory} from '@/application/fs/workingDirectory/virtualizedWorkingDirectory';
import {NodeImportConfig} from '@/application/project/import/tsConfigLoader';

describe('NodeImportResolver', () => {
    type Scenario = {
        description: string,
        filePath: string,
        sourcePath: string,
        expected: string,
        projectPath?: string,
        tsConfig: NodeImportConfig|null,
    };

    it.each<Scenario>([
        {
            description: 'resolve absolute paths when no tsconfig is provided',
            filePath: '/src/utils/markdown.ts',
            sourcePath: '/src/index.ts',
            expected: './utils/markdown',
            tsConfig: null,
        },
        {
            description: 'resolve relative paths when no tsconfig is provided',
            filePath: 'utils/markdown.ts',
            sourcePath: 'index.ts',
            expected: './utils/markdown',
            tsConfig: null,
        },
        {
            description: 'resolve absolute paths when a tsconfig is provided',
            filePath: '/project/src/utils/markdown.ts',
            sourcePath: '/project/src/index.ts',
            expected: '@/utils/markdown',
            projectPath: '/project',
            tsConfig: {
                baseUrl: '.',
                matchedConfigPath: 'tsconfig.json',
                rootConfigPath: 'tsconfig.json',
                paths: {
                    '@/*': ['src/*'],
                },
            },
        },
        {
            description: 'resolve relative paths when a tsconfig is provided',
            filePath: 'src/utils/markdown.ts',
            sourcePath: 'src/index.ts',
            expected: '@/utils/markdown',
            projectPath: '/project',
            tsConfig: {
                baseUrl: '.',
                matchedConfigPath: 'tsconfig.json',
                rootConfigPath: 'tsconfig.json',
                paths: {
                    '@/*': ['src/*'],
                },
            },
        },
        {
            description: 'resolve relative paths when no aliases match',
            filePath: 'other/utils/markdown.ts',
            sourcePath: 'x/index.ts',
            expected: '../other/utils/markdown',
            projectPath: '/project',
            tsConfig: {
                baseUrl: '.',
                matchedConfigPath: 'tsconfig.json',
                rootConfigPath: 'tsconfig.json',
                paths: {
                    '@/*': ['src/*'],
                },
            },
        },
        {
            description: 'resolve relative paths when no aliases exist',
            filePath: 'other/utils/markdown.ts',
            sourcePath: 'x/index.ts',
            expected: '../other/utils/markdown',
            projectPath: '/project',
            tsConfig: {
                baseUrl: '.',
                matchedConfigPath: 'tsconfig.json',
                rootConfigPath: 'tsconfig.json',
                paths: {
                },
            },
        },
        {
            description: 'resolve absolute paths with aliases pointing to the root',
            filePath: '/project/components/pricing-section.tsx',
            sourcePath: '/project/examples/pricing/page.tsx',
            expected: '@/components/pricing-section',
            projectPath: '/project',
            tsConfig: {
                baseUrl: '.',
                matchedConfigPath: 'tsconfig.json',
                rootConfigPath: 'tsconfig.json',
                paths: {
                    '@/*': ['./*'],
                },
            },
        },
        {
            description: 'resolve absolute paths with baseUrl pointing to other directory',
            filePath: '/project/src/components/pricing-section.tsx',
            sourcePath: '/project/src/examples/pricing/page.tsx',
            expected: '@/components/pricing-section',
            projectPath: '/project',
            tsConfig: {
                baseUrl: 'src',
                matchedConfigPath: 'tsconfig.json',
                rootConfigPath: 'tsconfig.json',
                paths: {
                    '@/*': ['./*'],
                },
            },
        },
        {
            description: 'resolve relative paths with baseUrl pointing to other directory',
            filePath: 'src/components/pricing-section.tsx',
            sourcePath: 'src/examples/pricing/page.tsx',
            expected: '@/components/pricing-section',
            projectPath: '/project',
            tsConfig: {
                baseUrl: 'src',
                matchedConfigPath: 'tsconfig.json',
                rootConfigPath: 'tsconfig.json',
                paths: {
                    '@/*': ['./*'],
                },
            },
        },
        /**
         * @todo add tests with different path separators to make sure the result is always in the same format
         * (requires a virtualized filesystem)
         */
    ])('should $description', async scenario => {
        const resolver = new NodeImportResolver({
            fileSystem: new LocalFilesystem({
                defaultEncoding: 'utf-8',
                workingDirectory: new VirtualizedWorkingDirectory(scenario.projectPath ?? '/'),
            }),
            projectDirectory: new VirtualizedWorkingDirectory(scenario.projectPath ?? '/'),
            tsConfigLoader: {
                load: (): Promise<NodeImportConfig|null> => Promise.resolve(scenario.tsConfig),
            },
        });

        const result = await resolver.getImportPath(scenario.filePath, scenario.sourcePath);

        expect(result).toEqual(scenario.expected);
    });
});
