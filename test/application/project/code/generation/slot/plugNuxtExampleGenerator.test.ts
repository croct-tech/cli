import {readFileSync, readdirSync} from 'fs';
import {basename, resolve} from 'path';
import type {SlotDefinition} from '@/application/project/code/generation/slot/slotExampleGenerator';
import type {Configuration} from '@/application/project/code/generation/slot/vueExampleGenerator';
import {PlugNuxtExampleGenerator} from '@/application/project/code/generation/slot/plugNuxtExampleGenerator';

describe('PlugNuxtExampleGenerator', () => {
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

    const tsOptions: Configuration = {
        typescript: true,
        contentVariable: 'data.content',
        slotImportPath: '~/components/%slug%.vue',
        slotFilePath: 'components/%slug%.vue',
        slotComponentName: '%name%',
        pageFilePath: 'pages/%slug%/index.vue',
    };

    it.each(fixtures)('should generate TypeScript SFCs for $name', ({name, definition}) => {
        const example = new PlugNuxtExampleGenerator(tsOptions).generate(definition);

        expect(example).toMatchSnapshot(name);
    });

    it.each(fixtures)('should generate JavaScript SFCs for $name', ({name, definition}) => {
        const example = new PlugNuxtExampleGenerator({...tsOptions, typescript: false}).generate(definition);

        expect(example).toMatchSnapshot(`${name}-js`);
    });

    it('should destructure only data from useContent', () => {
        const example = new PlugNuxtExampleGenerator(tsOptions)
            .generate(loadFixture('simpleStructure.json'));

        expect(example.files[1].code).toContain("const {data} = await useContent('home-hero@1');");
    });
});
