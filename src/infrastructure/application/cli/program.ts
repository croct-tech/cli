import {Argument, Command, InvalidArgumentError, Option} from '@commander-js/extra-typings';
import {JsonPrimitive, JsonValue} from '@croct/json';
import {realpathSync} from 'fs';
import {ApiKey} from '@croct/sdk/apiKey';
import {Cli} from '@/infrastructure/application/cli/cli';
import {Resource} from '@/application/cli/command/init';
import {OptionMap} from '@/application/template/template';
import {ApiKeyPermission, ApplicationEnvironment} from '@/application/model/application';
import packageJson from '@/../package.json';

type Configuration = {
    interactive: boolean,
    template?: OptionMap|null,
    cli?: Cli,
};

function createProgram(config: Configuration): typeof program {
    const program = new Command()
        .name('croct')
        .description('Manage your Croct projects')
        .enablePositionalOptions()
        .option('--cwd <path>', 'The working directory.', path => {
            try {
                return realpathSync(path);
            } catch {
                throw new InvalidArgumentError('The path does not exist.');
            }
        })
        .addOption(
            new Option('--api-key <key>', 'The API key to use for authentication.')
                .env('CROCT_API_KEY')
                .argParser(key => {
                    try {
                        return ApiKey.parse(key);
                    } catch {
                        throw new InvalidArgumentError('The API key is malformed.');
                    }
                }),
        )
        .option('--registry <url>', 'The template registry.', url => {
            if (!URL.canParse(url)) {
                throw new InvalidArgumentError('Malformed URL.');
            }

            return url;
        })
        .option('--no-interaction', 'Disable interaction mode.')
        .addOption(
            new Option('-s, --skip-prompts', 'Skip prompts with default options.')
                .default(false),
        )
        .addOption(
            new Option('-q, --quiet', 'Disable output messages.')
                .default(false)
                .implies({interaction: false}),
        )
        .option('--debug', 'Enable debug mode.')
        .version(packageJson.version, '-v, --version', 'Display the version number.')
        .helpOption('-h, --help', 'Display help for a command.')
        .helpCommand('help [command]', 'Display help for a command.');

    program.command('open <url>')
        .description('Open a deep link.')
        .action(async url => {
            await config.cli?.open({
                url: url,
            });
        });

    const loginCommand = program.command('login')
        .description('Authenticate your user.');

    const usernameOption = new Option('-u, --username <username>', 'The email.');
    const passwordOption = new Option('-p, --password <password>', 'The password.');

    loginCommand.command('credentials', {isDefault: true})
        .description('Authenticate using credentials.')
        .addOption(config.interactive ? usernameOption : usernameOption.makeOptionMandatory())
        .addOption(config.interactive ? passwordOption : passwordOption.makeOptionMandatory())
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
        .addOption(
            new Option('--skip-api-key-setup', 'Opt-out of API key setup.')
                .default(false)
                .env('CROCT_SKIP_API_KEY_SETUP'),
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
                skipApiKeySetup: options.skipApiKeySetup,
            });
        });

    program.command('install')
        .description('Install content and types.')
        .action(async () => {
            await config.cli?.install({});
        });

    program.command('update')
        .description('Update content and types.')
        .action(async () => {
            await config.cli?.install({
                clean: true,
            });
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
        .description('Add a slot to your project.')
        .argument(config.interactive ? '[slots...]' : '<slots...>')
        .option('-e, --example', 'Generate an implementation example.')
        .action(async (args, options) => {
            await config.cli?.addSlot({
                slots: args,
                example: options.example,
            });
        });

    addCommand.command('component')
        .description('Add a component to your project.')
        .argument(config.interactive ? '[components...]' : '<components...>')
        .action(async args => {
            await config.cli?.addComponent({
                components: args,
            });
        });

    const removeCommand = program.command('remove')
        .description('Remove a resource from your project.');

    removeCommand.command('slot')
        .description('Remove a slot from your project.')
        .argument(config.interactive ? '[slots...]' : '<slots...>')
        .action(async args => {
            await config.cli?.removeSlot({
                slots: args,
            });
        });

    removeCommand.command('component')
        .description('Remove a component from your project.')
        .argument(config.interactive ? '[components...]' : '<components...>')
        .action(async args => {
            await config.cli?.removeComponent({
                components: args,
            });
        });

    const createCommand = program.command('create')
        .description('Create a resource in your project.');

    createCommand.command('template')
        .description('Create a template from your project.')
        .addArgument(
            new Argument('<path>', 'The path to the file.')
                .argOptional(),
        )
        .option('-e, --empty', 'Create an empty template.')
        .action(async (path, options) => {
            await config.cli?.createTemplate({
                file: path,
                empty: options.empty,
            });
        });

    const permissionOption = new Option('--permissions <permissions...>', 'The permissions of the API key.')
        .argParser(
            value => value.split(',').map(permission => {
                try {
                    return ApiKeyPermission.fromValue(permission);
                } catch {
                    throw new InvalidArgumentError(`Unknown permission "${permission}".`);
                }
            }),
        );

    const environmentOption = new Option('--env <environment>', 'The environment of the API key.')
        .choices(['prod', 'dev'])
        .argParser(
            value => (
                value === 'prod'
                    ? ApplicationEnvironment.PRODUCTION
                    : ApplicationEnvironment.DEVELOPMENT
            ),
        );

    createCommand.command('api-key')
        .description('Create an API key.')
        .option('--name <name>', 'The name of the API key.')
        .addOption(config.interactive ? permissionOption : permissionOption.makeOptionMandatory())
        .addOption(config.interactive ? environmentOption : environmentOption.makeOptionMandatory())
        .option('-c, --copy', 'Copy the API key to the clipboard.')
        .action(async options => {
            await config.cli?.createApiKey({
                name: options.name,
                permissions: options.permissions,
                environment: options.env,
                copy: options.copy,
            });
        });

    const optionNames: Record<string, string> = {};

    const useCommand = program.command('use')
        .description('Use a template.')
        .argument('template', 'The path to the template.')
        .passThroughOptions(config.cli === undefined)
        .allowUnknownOption(config.cli === undefined || config.template === null)
        .action(async (template, options) => {
            await config.cli?.useTemplate({
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
                    const number = Number.parseFloat(value);

                    if (Number.isNaN(number)) {
                        throw new InvalidArgumentError('The value must be a number.');
                    }

                    return number;
                });

                break;

            case 'array':
                option.argParser(list => {
                    let value: JsonValue | undefined;

                    try {
                        value = JSON.parse(list);
                    } catch {
                        // Ignore
                    }

                    if (value === undefined || !Array.isArray(value)) {
                        throw new InvalidArgumentError('The value must be a JSON array.');
                    }

                    return value;
                });

                break;

            case 'object':
                option.argParser(json => {
                    let value: JsonValue;

                    try {
                        value = JSON.parse(json);
                    } catch {
                        throw new InvalidArgumentError('The JSON is malformed.');
                    }

                    if (typeof value !== 'object' || value === null) {
                        throw new InvalidArgumentError('The value must be a JSON object.');
                    }
                });

                break;
        }

        optionNames[option.attributeName()] = name;

        useCommand.addOption(option);
    }

    const enable = program.command('enable')
        .description('Enable a feature.');

    enable.command('deep-link')
        .description('Enable deep link support.')
        .action(async () => {
            await config.cli?.deepLink({
                operation: 'enable',
            });
        });

    const disable = program.command('disable')
        .description('Disable a feature.');

    disable.command('deep-link')
        .description('Disable deep link support.')
        .action(async () => {
            await config.cli?.deepLink({
                operation: 'disable',
            });
        });

    return program;
}

function getTemplate(args: string[]): string | null {
    const commands = ['use', 'help use'];

    for (const command of commands) {
        const index = command.split(' ').length;

        if (args.length > index && args.slice(0, index).join(' ') === command && (args[index] ?? '') !== '') {
            return args[index];
        }
    }

    return null;
}

function isDeepLinkCommand(args: string[]): boolean {
    return args.length >= 2 && ['enable', 'disable'].includes(args[0]) && args[1] === 'deep-link';
}

export async function run(args: string[] = process.argv, welcome = true): Promise<void> {
    const invocation = createProgram({interactive: true}).parse(args);

    const options = invocation.opts();

    const cli = Cli.fromDefaults({
        program: params => run(invocation.args.slice(0, 2).concat(params)),
        version: packageJson.version,
        quiet: options.quiet,
        debug: options.debug,
        interactive: options.interaction ? undefined : false,
        apiKey: options.apiKey,
        skipPrompts: options.skipPrompts === true,
        templateRegistryUrl: options.registry === undefined
            ? undefined
            : new URL(options.registry),
    });

    const template = getTemplate(invocation.args);

    const templateOptions = template !== null
        ? await cli.getTemplateOptions(template).catch(() => null)
        : undefined;

    const program = createProgram({
        cli: cli,
        interactive: options.interaction,
        template: templateOptions,
    });

    if (welcome) {
        await cli.welcome({
            skipDeepLinkCheck: isDeepLinkCommand(invocation.args),
        });
    }

    await program.parseAsync(args);
}
