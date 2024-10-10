#!/usr/bin/env node
import {Command, Option} from '@commander-js/extra-typings';
import XDGAppPaths from 'xdg-app-paths';
import * as process from 'node:process';
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
                current: options.cwd ?? process.cwd(),
            },
            api: {
                graphqlEndpoint: `${apiEndpoint}/graphql`,
                tokenEndpoint: `${apiEndpoint}/account/issue-token`,
                tokenParameter: 'session',
            },
            exitCallback: () => process.exit(1),
        });
    }
    program.command('init')
        .description('Configure the your project.')
        .option('-o, --override', 'override any existing configuration')
        .addOption(
            new Option('--new <resource>', 'specify the resources to create')
                .choices(['organization', 'workspace', 'application'] as const),
        )
        .addOption(
            new Option('--sdk <platform>', 'specify the SDK')
                .choices(['javascript', 'react', 'next'] as const),
        )
        .action(async options => {
            await run().init({
                override: options.override,
                new: options.new,
                sdk: options.sdk,
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

    await program.parseAsync();
}());
