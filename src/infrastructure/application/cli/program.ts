import {Command, InvalidArgumentError, Option} from '@commander-js/extra-typings';
import XDGAppPaths from 'xdg-app-paths';
import * as process from 'node:process';
import {resolve} from 'path';
import ci from 'ci-info';
import {JsonPrimitive} from '@croct/json';
import {Cli} from '@/infrastructure/application/cli/cli';
import {Resource} from '@/application/cli/command/init';
import {OptionMap} from '@/application/template/template';

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const apiEndpoint = 'https://pr-2389-merge---croct-admin-backend-xzexsnymka-rj.a.run.app';
const templateRegistry = 'https://github.com/marcospassos/croct-examples/blob/main/registry.json';

type Configuration = {
    interactive: boolean,
    template?: OptionMap,
    cli?: Cli,
};

function createProgram(config: Configuration): typeof program {
    const program = new Command()
        .name('croct')
        .description('Manage your Croct projects.')
        .version('0.0.1', '-v, --version', 'Display the version number')
        .option('-d, --cwd <path>', 'The working directory')
        .option('-r, --registry <url>', 'The template registry')
        .option('-ni, --no-interaction', 'Disable interaction mode')
        .option('-nc, --no-cache', 'Disable cache')
        .helpOption(config.cli !== undefined)
        .helpCommand(config.cli !== undefined)
        .addOption(
            new Option('-q, --quiet', 'Disable output messages')
                .default(false)
                .implies({interaction: false}),
        );

    const loginCommand = program.command('login')
        .description('Authenticate your user.');

    const usernameOption = new Option('-u, --username <username>', 'The email');
    const passwordOption = new Option('-p, --password <password>', 'The password');

    loginCommand.command('credentials', {isDefault: true})
        .addOption(config.interactive ? usernameOption : usernameOption.makeOptionMandatory())
        .addOption(config.interactive ? passwordOption : passwordOption.makeOptionMandatory())
        .description('Authenticate using credentials.')
        .action(async options => {
            await config.cli?.login({
                method: 'credentials',
                username: options.username,
                password: options.password,
            });
        });

    program.command('logout')
        .description('Logout the current user.')
        .action(async () => {
            await config.cli?.logout();
        });

    program.command('admin')
        .argument('[page...]', 'The name of the page or path to open')
        .description('Log in and open the admin panel.')
        .action(async path => {
            await config.cli?.admin({
                // eslint-disable-next-line no-nested-ternary -- Best option for this case
                page: path !== undefined
                    ? path.join(' ')
                    : (config.interactive ? undefined : '/'),
            });
        });

    const workspaceOption = new Option('--wor <workspace-slug>', 'The workspace');
    const organizationOption = new Option('--org <organization-slug>', 'The organization');
    const devApplicationOption = new Option('--dev-app <application-slug>', 'The development application');
    const prodApplicationOption = new Option('--prod-app <application-slug>', 'The production application');

    program.command('init')
        .description('Configure the project.')
        .option('-o, --override', 'Override any existing configuration')
        .addOption(
            new Option('-n, --new <resource>', 'The resources to create')
                .choices(['organization', 'org', 'workspace', 'wor', 'application', 'app'] as const),
        )
        .addOption(
            new Option('-s, --sdk <platform>', 'The SDK')
                .choices(['javascript', 'react', 'next'] as const),
        )
        .addOption(config.interactive ? organizationOption : organizationOption.makeOptionMandatory())
        .addOption(config.interactive ? workspaceOption : workspaceOption.makeOptionMandatory())
        .addOption(config.interactive ? devApplicationOption : devApplicationOption.makeOptionMandatory())
        .addOption(prodApplicationOption)
        .action(async options => {
            await config.cli?.init({
                override: options.override,
                new: ((): Resource | undefined => {
                    switch (options.new) {
                        case 'organization':
                        case 'org':
                            return 'organization';

                        case 'workspace':
                        case 'wor':
                            return 'workspace';

                        case 'application':
                        case 'app':
                            return 'application';

                        default:
                            return undefined;
                    }
                })(),
                sdk: options.sdk,
                organization: options.org,
                workspace: options.wor,
                devApplication: options.devApp,
                prodApplication: options.prodApp,
            });
        });

    program.command('install')
        .description('Download content and generate types.')
        .action(async () => {
            await config.cli?.install({});
        });

    program.command('upgrade')
        .description('Upgrade components and slots to the latest version.')
        .option('-s, --slots <slots...>', 'The slots to upgrade')
        .option('-c, --components <components...>', 'The components to upgrade')
        .action(async options => {
            await config.cli?.upgrade({
                // The null coalescing operator is used to ensure that
                // specifying --slots won't affect --components and vice versa
                slots: options.slots ?? (options.components !== undefined ? [] : undefined),
                components: options.components ?? (options.slots !== undefined ? [] : undefined),
            });
        });

    const addCommand = program.command('add')
        .description('Add a resource to your project.');

    addCommand.command('slot')
        .argument(config.interactive ? '[slots...]' : '<slots...>')
        .option('-e, --example', 'Generate an implementation example')
        .description('Add a slot to your project.')
        .action(async (args, options) => {
            await config.cli?.addSlot({
                slots: args,
                example: options.example,
            });
        });

    addCommand.command('component')
        .argument(config.interactive ? '[components...]' : '<components...>')
        .description('Add a component to your project.')
        .action(async args => {
            await config.cli?.addComponent({
                components: args,
            });
        });

    const removeCommand = program.command('remove')
        .description('Remove a resource from your project.');

    removeCommand.command('slot')
        .argument(config.interactive ? '[slots...]' : '<slots...>')
        .description('Remove a slot from your project.')
        .action(async args => {
            await config.cli?.removeSlot({
                slots: args,
            });
        });

    removeCommand.command('component')
        .argument(config.interactive ? '[components...]' : '<components...>')
        .description('Remove a component from your project.')
        .action(async args => {
            await config.cli?.removeComponent({
                components: args,
            });
        });

    const createCommand = program.command('create')
        .description('Create a resource in your project.');

    createCommand.command('template')
        .argument('path', 'The path to save the template')
        .description('Export a template from your project.')
        .action(async (path: string) => {
            await config.cli?.createTemplate({
                file: path,
            });
        });

    const importCommand = program.command('import')
        .enablePositionalOptions(config.cli === undefined)
        .description('Import a resource into your project.');

    const optionNames: Record<string, string> = {};

    const templateCommand = importCommand.command('template')
        .argument('template', 'The path to the template')
        .description('Import a template into your project.')
        .passThroughOptions(config.cli === undefined)
        .allowUnknownOption(config.cli === undefined)
        .action(async (template, options) => {
            await config.cli?.importTemplate({
                template: template,
                options: Object.fromEntries(
                    Object.entries(options)
                        .map(([key, value]) => [optionNames[key], value as JsonPrimitive]),
                ),
            });
        });

    for (const [name, definition] of Object.entries(config.template ?? {})) {
        const usage = `--${name}${definition.type !== 'boolean' ? ' <value>' : ''}`;

        const option = new Option(usage, definition.description)
            .makeOptionMandatory(definition.required === true);

        switch (definition.type) {
            case 'string':
                if (definition.choices !== undefined && definition.choices.length > 0) {
                    option.choices(definition.choices);
                }

                break;

            case 'number':
                option.argParser(value => {
                    const parsedValue = Number.parseFloat(value);

                    if (Number.isNaN(parsedValue)) {
                        throw new InvalidArgumentError('The value must be a number.');
                    }

                    return value;
                });

                break;

            case 'array':
                option.argParser(value => value.split(','));

                break;
        }

        optionNames[option.attributeName()] = name;

        templateCommand.addOption(option);
    }

    return program;
}

(async function main(): Promise<void> {
    const parsedInput = createProgram({interactive: true}).parse();

    const {args} = parsedInput;
    const options = parsedInput.opts();
    const appPaths = XDGAppPaths('com.croct.cli');

    const cli = new Cli({
        io: {
            input: process.stdin,
            output: process.stdout,
        },
        directories: {
            config: appPaths.config(),
            cache: appPaths.cache(),
            current: options.cwd !== undefined
                ? resolve(options.cwd)
                : process.cwd(),
        },
        api: {
            graphqlEndpoint: `${apiEndpoint}/graphql`,
            tokenEndpoint: `${apiEndpoint}/account/issue-token`,
            tokenParameter: 'session',
            authenticationEndpoint: `${apiEndpoint}/start/`,
            authenticationParameter: 'session',
        },
        nameRegistry: new URL(options.registry ?? templateRegistry),
        cache: options.cache,
        quiet: options.quiet,
        interactive: options.interaction && !ci.isCI,
        exitCallback: () => process.exit(1),
    });

    const program = createProgram({
        cli: cli,
        interactive: options.interaction,
        template: args[0] === 'import' && args[1] === 'template' && args[2] !== undefined
            ? await cli.getTemplateOptions(args[2])
            : undefined,
    });

    await program.parseAsync();
}());
