import {readFileSync, readdirSync} from 'fs';
import {basename, resolve} from 'path';
import type {SlotDefinition} from '@/application/project/code/generation/slot/slotExampleGenerator';
import type {Configuration} from '@/application/project/code/generation/slot/hydrogenExampleGenerator';
import {HydrogenExampleGenerator} from '@/application/project/code/generation/slot/hydrogenExampleGenerator';

describe('HydrogenExampleGenerator', () => {
    const fixturesPath = resolve(__dirname, 'fixtures');

    function loadFixture(file: string): SlotDefinition {
        return JSON.parse(readFileSync(resolve(fixturesPath, file), 'utf-8'));
    }

    const fixtures = readdirSync(fixturesPath).filter(file => file.endsWith('.json'))
        .map(
            file => ({
                name: basename(file, '.json'),
                definition: loadFixture(file),
            }),
        );

    const baseOptions: Configuration = {
        typescript: true,
        framework: 'react-router',
        routeFilePath: 'app/routes/%slug%.tsx',
        routeComponentName: '%name%Route',
    };

    const variants: Array<{label: string, options: Partial<Configuration>}> = [
        {label: 'react-router-ts', options: {framework: 'react-router', typescript: true}},
        {label: 'react-router-js', options: {framework: 'react-router', typescript: false}},
        {label: 'remix-ts', options: {framework: 'remix', typescript: true}},
        {label: 'remix-js', options: {framework: 'remix', typescript: false}},
    ];

    it.each(variants)('should generate the $label route', ({label, options}) => {
        // A single fixture exercises every era/language variant; the content-shape variations are
        // covered by the per-fixture cases below.
        const example = new HydrogenExampleGenerator({...baseOptions, ...options})
            .generate(loadFixture('simpleStructure.json'));

        expect(example).toMatchSnapshot(label);
    });

    it.each(fixtures)('should generate a route for $name', ({name, definition}) => {
        const example = new HydrogenExampleGenerator(baseOptions).generate(definition);

        expect(example).toMatchSnapshot(name);
    });

    it('fetches the slot server-side and renders the content directly', () => {
        const [route] = new HydrogenExampleGenerator(baseOptions)
            .generate(loadFixture('simpleStructure.json'))
            .files;

        expect(route.code).toContain("const {content} = await fetchContent('home-hero', {scope: context});");
        expect(route.code).toContain('const {content} = useLoaderData<typeof loader>();');
        expect(route.code).not.toContain('<Slot');
        expect(route.code).not.toContain('JSON.stringify');
    });
});
