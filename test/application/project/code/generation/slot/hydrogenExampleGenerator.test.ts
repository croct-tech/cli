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
        era: 'react-router',
        routeFilePath: 'app/routes/%slug%.tsx',
        routeComponentName: '%name%Route',
    };

    const variants: Array<{label: string, options: Partial<Configuration>}> = [
        {label: 'react-router-ts', options: {era: 'react-router', typescript: true}},
        {label: 'react-router-js', options: {era: 'react-router', typescript: false}},
        {label: 'remix-ts', options: {era: 'remix', typescript: true}},
        {label: 'remix-js', options: {era: 'remix', typescript: false}},
    ];

    it.each(variants)('should generate the $label route', ({label, options}) => {
        // The content shape does not affect the route, so a single fixture exercises every variant.
        const example = new HydrogenExampleGenerator({...baseOptions, ...options})
            .generate(loadFixture('simpleStructure.json'));

        expect(example).toMatchSnapshot(label);
    });

    it.each(fixtures)('should generate a route for $name', ({name, definition}) => {
        const example = new HydrogenExampleGenerator(baseOptions).generate(definition);

        expect(example).toMatchSnapshot(name);
    });

    it('fetches the slot server-side and seeds the client Slot', () => {
        const [route] = new HydrogenExampleGenerator(baseOptions)
            .generate(loadFixture('simpleStructure.json'))
            .files;

        expect(route.code).toContain("const {content} = await fetchContent('home-hero', {context});");
        expect(route.code).toContain('<Slot id="home-hero" initial={data.content}>');
    });
});
