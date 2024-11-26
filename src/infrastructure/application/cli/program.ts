#!/usr/bin/env node
import {Command, Option} from '@commander-js/extra-typings';
import XDGAppPaths from 'xdg-app-paths';
import * as process from 'node:process';
import {resolve} from 'path';
import {Cli} from '@/infrastructure/application/cli/cli';

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const apiEndpoint = 'https://pr-2389-merge---croct-admin-backend-xzexsnymka-rj.a.run.app';

(async function main(): Promise<void> {
    const program = new Command()
        .name('croct')
        .description('Manage your Croct projects.')
        .version('0.0.1', '-v, --version', 'Display the version number')
        .option('-d, --cwd <path>', 'Specify the working directory');

    function run(): Cli {
        const options = program.opts();

        return new Cli({
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
            exitCallback: () => process.exit(1),
        });
    }

    program.command('init')
        .description('Configure the your project.')
        .option('-o, --override', 'Override any existing configuration')
        .addOption(
            new Option('-n, --new <resource>', 'Specify the resources to create')
                .choices(['organization', 'workspace', 'application'] as const),
        )
        .addOption(
            new Option('-s, --sdk <platform>', 'Specify the SDK')
                .choices(['javascript', 'react', 'next'] as const),
        )
        .action(async options => {
            await run().init({
                override: options.override,
                new: options.new,
                sdk: options.sdk,
            });
        });

    const addCommand = program.command('add')
        .description('Add a resource to your project.');

    addCommand.command('slot [slots...]')
        .option('-e, --example', 'Generate an implementation example')
        .description('Add a slot to your project.')
        .action(async (args, options) => {
            await run().addSlot({
                slots: args,
                example: options.example,
            });
        });

    addCommand.command('component [components...]')
        .description('Add a component to your project.')
        .action(async args => {
            await run().addComponent({
                components: args,
            });
        });

    const removeCommand = program.command('remove')
        .description('Remove a resource from your project.');

    removeCommand.command('slot [slots...]')
        .description('Remove a slot from your project.')
        .action(async args => {
            await run().removeSlot({
                slots: args,
            });
        });

    removeCommand.command('component [components...]')
        .description('Remove a component from your project.')
        .action(async args => {
            await run().removeComponent({
                components: args,
            });
        });

    program.command('login')
        .description('Authenticate your user.')
        .action(async () => {
            await run().login();
        });

    program.command('logout')
        .description('Logout the current user.')
        .action(async () => {
            await run().logout();
        });

    program.command('admin')
        .description('Login and open admin in browser.')
        .action(async () => {
            await run().admin();
        });

    await program.parseAsync();
}());
