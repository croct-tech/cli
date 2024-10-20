import {readdirSync, readFileSync} from 'fs';
import {basename, join} from 'path';

export type FixtureScenario<O> = {
    name: string,
    fixture: string,
    options: O,
};

export function loadFixtures<T>(
    fixturePath: string,
    defaultOptions: T,
    fixtureOptions: Record<string, Partial<T>>,
): Array<FixtureScenario<T>> {
    const scenarios: Record<string, FixtureScenario<T>> = {};

    for (const file of readdirSync(fixturePath)) {
        if (!file.includes('.transformed.')) {
            const name = basename(file);

            scenarios[name] = {
                name: name,
                fixture: readFileSync(join(fixturePath, name), 'utf-8'),
                options: {
                    ...defaultOptions,
                    ...fixtureOptions[name],
                },
            };
        }
    }

    for (const name of Object.keys(scenarios)) {
        if (scenarios[name] === undefined) {
            throw new Error(`Fixture options reference missing fixture: ${name}`);
        }
    }

    return Object.values(scenarios);
}
