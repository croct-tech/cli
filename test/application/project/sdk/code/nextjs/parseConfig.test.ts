import {basename, join, resolve} from 'path';
import {readdirSync, readFileSync} from 'fs';
import {NextConfig, parseConfig} from '@/application/project/sdk/code/nextjs/parseConfig';

describe('parseConfig', () => {
    const fixturePath = resolve(__dirname, '../fixtures/nextjs-config');

    type Scenario = {
        name: string,
        expected: NextConfig,
    };

    const defaultExpectation: NextConfig = {
        i18n: {
            locales: ['en', 'pt'],
            defaultLocale: 'en',
        },
    };

    const expectation: Record<string, NextConfig> = {
        'empty.js': {
            i18n: {
                locales: [],
            },
        },
        'invalidCode.js': {
            i18n: {
                locales: [],
            },
        },
        'invalidConfig.js': {
            i18n: {
                locales: [],
            },
        },
        'invalidI18n.js': {
            i18n: {
                locales: [],
            },
        },
    };

    function loadScenarios(): Scenario[] {
        const scenarios: Record<string, Scenario> = [];

        for (const scenario of readdirSync(fixturePath)) {
            const name = basename(scenario);

            scenarios[name] = ({
                name: scenario,
                expected: expectation[name] ?? defaultExpectation,
            });
        }

        for (const name of Object.keys(expectation)) {
            if (scenarios[name] === undefined) {
                throw new Error(`Fixture options reference missing fixture: ${name}`);
            }
        }

        return Object.values(scenarios);
    }

    it.each(loadScenarios())('should correctly transform $name', ({name, expected}) => {
        const config = parseConfig(readFileSync(join(fixturePath, name), 'utf-8'));

        expect(config).toEqual(expected);
    });
});
