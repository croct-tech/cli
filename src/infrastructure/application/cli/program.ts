import {Command, InvalidArgumentError, Option} from '@commander-js/extra-typings';
import XDGAppPaths from 'xdg-app-paths';
import process from 'node:process';
import {delimiter, resolve} from 'path';
import ci from 'ci-info';
import {JsonPrimitive} from '@croct/json';
import {Cli} from '@/infrastructure/application/cli/cli';
import {Resource} from '@/application/cli/command/init';
import {OptionMap} from '@/application/template/template';
import {EventDispatcher, ProcessEvents} from '@/application/event';

const apiEndpoint = 'https://pr-2389-merge---croct-admin-backend-xzexsnymka-rj.a.run.app';
const templateRegistry = 'github:/marcospassos/croct-examples/registry.json';
const adminUrl = 'https://preview.app.croct.dev/pr-3359';

type Configuration = {
    interactive: boolean,
    template?: OptionMap,
    cli?: Cli,
};

function createProgram(config: Configuration): typeof program {
    const program = new Command()
        .name('croct')
        .description('Manage your Croct projects')
        .version('0.0.1', '-v, --version', 'Display the version number.')
        .option('-d, --cwd <path>', 'The working directory.')
        .option('-n, --no-interaction', 'Disable interaction mode.')
        .option('--registry <url>', 'The template registry.')
        .option('-s, --skip-prompts', 'Skip prompts with default options.')
        .option('--no-cache', 'Disable cache.')
        .addOption(
            new Option('-q, --quiet', 'Disable output messages.')
                .default(false)
                .implies({interaction: false}),
        );

    // Override the help command to not execute in the pre-execution phase
    // since it exits the process prematurely
    const helpCommand = new Command('help')
        .description('Display help for the command.');

    const helpOption = new Option('-h, --help', 'Display help for the command.');

    program.helpCommand(helpCommand.name(), helpCommand.description());
    program.helpOption(helpOption.flags, helpOption.description);

    const loginCommand = program.command('login')
        .description('Authenticate your user.');

    const usernameOption = new Option('-u, --username <username>', 'The email.');
    const passwordOption = new Option('-p, --password <password>', 'The password.');

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
        .argument('[page...]', 'The name of the page or path to open.')
        .description('Log in and open the admin panel.')
        .action(async path => {
            await config.cli?.admin({
                // eslint-disable-next-line no-nested-ternary -- Best option for this case
                page: path !== undefined
                    ? path.join(' ')
                    : (config.interactive ? undefined : '/'),
            });
        });

    const workspaceOption = new Option('--wor <workspace-slug>', 'The workspace slug.');
    const organizationOption = new Option('--org <organization-slug>', 'The organization slug.');
    const devApplicationOption = new Option('--dev-app <application-slug>', 'The development application slug.');
    const prodApplicationOption = new Option('--prod-app <application-slug>', 'The production application slug.');

    program.command('init')
        .description('Configure the project.')
        .option('-o, --override', 'Override any existing configuration.')
        .addOption(
            new Option('-n, --new <resource>', 'The resources to create.')
                .choices(['organization', 'org', 'workspace', 'wor', 'application', 'app'] as const),
        )
        .addOption(
            new Option('-s, --sdk <platform>', 'The SDK to use.')
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
        .option('-s, --slots <slots...>', 'The slots to upgrade.')
        .option('-c, --components <components...>', 'The components to upgrade.')
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
        .option('-e, --example', 'Generate an implementation example.')
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
        .argument('path', 'The path to save the template.')
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
        .argument('template', 'The path to the template.')
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
                if (definition.options !== undefined && definition.options.length > 0) {
                    option.choices(definition.options);
                }

                break;

            case 'number':
                option.argParser(value => {
                    const number = Number.parseFloat(value);

                    if (Number.isNaN(number)) {
                        throw new InvalidArgumentError('The value must be a number.');
                    }

                    return number;
                });

                break;

            case 'array':
                option.argParser(value => value.split(','));

                break;
        }

        optionNames[option.attributeName()] = name;

        templateCommand.addOption(option);
    }

    if (config.template === undefined) {
        importCommand.helpCommand(false);
        importCommand.addCommand(helpCommand);
        templateCommand.helpOption(false);
    }

    return program;
}

function getTemplate(args: string[]): string | null {
    const commands = ['import template', 'import help template'];

    for (const command of commands) {
        const index = command.split(' ').length;

        if (args.length > index && args.slice(0, index).join(' ') === command && (args[index] ?? '') !== '') {
            return args[index];
        }
    }

    return null;
}

(async function main(): Promise<void> {
    const parsedInput = createProgram({interactive: true}).parse();

    const {args} = parsedInput;
    const options = parsedInput.opts();
    const appPaths = XDGAppPaths('com.croct.cli');
    const eventEmitter = new EventDispatcher<ProcessEvents>();

    const exit = async (exitCode: number = 0): Promise<never> => {
        await eventEmitter.emit('exit').catch(() => {});

        return process.exit(exitCode);
    };

    process.on('SIGTERM', () => exit());
    process.on('SIGINT', () => exit());

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
        adminUrl: adminUrl,
        nameRegistry: new URL(options.registry ?? templateRegistry),
        cache: options.cache,
        quiet: options.quiet,
        interactive: options.interaction && !ci.isCI,
        skipPrompts: options.skipPrompts === true,
        exitCallback: () => exit(1),
        processObserver: eventEmitter,
        environment: {
            platform: process.platform,
            executablePaths: process.env
                .PATH
                ?.split(delimiter) ?? [],
            executableExtensions: process.env
                .PATHEXT
                ?.split(delimiter) ?? [],
        },
    });

    const template = getTemplate(args);

    const program = createProgram({
        cli: cli,
        interactive: options.interaction,
        template: template !== null
            ? await cli.getTemplateOptions(template)
            : undefined,
    });

    await program.parseAsync();
}());
