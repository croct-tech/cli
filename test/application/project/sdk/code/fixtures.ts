import {readdirSync, readFileSync, writeFileSync} from 'fs';
import {basename, join, dirname} from 'path';
import {CodeTransformer} from '@/application/project/sdk/code/transformation';

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
                fixture: join(fixturePath, name),
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

export function assertTransformed(fixture: string, transformer: CodeTransformer<string>): void {
    const fixturePath = dirname(fixture);
    const input = readFileSync(fixture, 'utf-8');
    let output: string | null = null;

    const extension = fixture.split('.').pop();
    const transformedFixture = `${basename(fixture, `.${extension}`)}.transformed.${extension}`;

    try {
        output = readFileSync(join(fixturePath, transformedFixture), 'utf-8');
    } catch {
        // ignore
    }

    const result = transformer.transform(input);

    if (output === null) {
        writeFileSync(join(fixturePath, transformedFixture), result.result);
    }

    expect(output).not.toBeNull();

    expect(result.modified).toEqual(input !== output);
    expect(result.result).toEqual(output);
}
