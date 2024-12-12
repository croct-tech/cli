import {Command, Option} from '@commander-js/extra-typings';
import XDGAppPaths from 'xdg-app-paths';
import * as process from 'node:process';
import {resolve} from 'path';
import ci from 'ci-info';
import {Cli} from '@/infrastructure/application/cli/cli';
import {Resource} from '@/application/cli/command/init';

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const apiEndpoint = 'https://pr-2389-merge---croct-admin-backend-xzexsnymka-rj.a.run.app';

function createProgram(interactive: boolean, cli?: Cli): typeof program {
    const program = new Command()
        .name('croct')
        .description('Manage your Croct projects.')
        .version('0.0.1', '-v, --version', 'Display the version number')
        .option('-d, --cwd <path>', 'The working directory')
        .option('-n, --no-interaction', 'Disable interaction mode')
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
        .addOption(interactive ? usernameOption : usernameOption.makeOptionMandatory())
        .addOption(interactive ? passwordOption : passwordOption.makeOptionMandatory())
        .description('Authenticate using credentials.')
        .action(async options => {
            await cli?.login({
                method: 'credentials',
                username: options.username,
                password: options.password,
            });
        });

    program.command('logout')
        .description('Logout the current user.')
        .action(async () => {
            await cli?.logout();
        });

    program.command('admin')
        .argument('[page...]', 'The name of the page or path to open')
        .description('Log in and open the admin panel.')
        .action(async path => {
            await cli?.admin({
                // eslint-disable-next-line no-nested-ternary -- Best option for this case
                page: path !== undefined
                    ? path.join(' ')
                    : (interactive ? undefined : '/'),
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
        .addOption(interactive ? organizationOption : organizationOption.makeOptionMandatory())
        .addOption(interactive ? workspaceOption : workspaceOption.makeOptionMandatory())
        .addOption(interactive ? devApplicationOption : devApplicationOption.makeOptionMandatory())
        .addOption(prodApplicationOption)
        .action(async options => {
            await cli?.init({
                override: options.override,
                new: ((): Resource|undefined => {
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
            await cli?.install({});
        });

    program.command('upgrade')
        .description('Upgrade components and slots to the latest version.')
        .option('-s, --slots <slots...>', 'The slots to upgrade')
        .option('-c, --components <components...>', 'The components to upgrade')
        .action(async options => {
            await cli?.upgrade({
                // The null coalescing operator is used to ensure that
                // specifying --slots won't affect --components and vice versa
                slots: options.slots ?? (options.components !== undefined ? [] : undefined),
                components: options.components ?? (options.slots !== undefined ? [] : undefined),
            });
        });

    const addCommand = program.command('add')
        .description('Add a resource to your project.');

    addCommand.command('slot')
        .argument(interactive ? '[slots...]' : '<slots...>')
        .option('-e, --example', 'Generate an implementation example')
        .description('Add a slot to your project.')
        .action(async (args, options) => {
            await cli?.addSlot({
                slots: args,
                example: options.example,
            });
        });

    addCommand.command('component')
        .argument(interactive ? '[components...]' : '<components...>')
        .description('Add a component to your project.')
        .action(async args => {
            await cli?.addComponent({
                components: args,
            });
        });

    const removeCommand = program.command('remove')
        .description('Remove a resource from your project.');

    removeCommand.command('slot')
        .argument(interactive ? '[slots...]' : '<slots...>')
        .description('Remove a slot from your project.')
        .action(async args => {
            await cli?.removeSlot({
                slots: args,
            });
        });

    removeCommand.command('component')
        .argument(interactive ? '[components...]' : '<components...>')
        .description('Remove a component from your project.')
        .action(async args => {
            await cli?.removeComponent({
                components: args,
            });
        });

    return program;
}

(async function main(): Promise<void> {
    const options = createProgram(true)
        .parse()
        .opts();

    const cli = new Cli({
        io: {
            input: process.stdin,
            output: process.stdout,
        },
        directories: {
            config: XDGAppPaths('com.croct.cli').config(),
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
        quiet: options.quiet,
        interactive: options.interaction && !ci.isCI,
        exitCallback: () => process.exit(1),
    });

    const program = createProgram(options.interaction, cli);

    await program.parseAsync();
}());
