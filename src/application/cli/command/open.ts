import {Command} from '@/application/cli/command/command';
import {ErrorReason, HelpfulError} from '@/application/error';
import {CliConfiguration} from '@/application/cli/configuration/store';
import {CurrentWorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {Provider} from '@/application/provider/provider';
import {Input} from '@/application/cli/io/input';
import {FileSystem} from '@/application/fs/fileSystem';
import {Output} from '@/application/cli/io/output';

export type OpenInput = {
    url: string,
};

export type Program = (args: string[]) => Promise<void>;

export type OpenConfig = {
    protocol: string,
    program: Program,
    fileSystem: FileSystem,
    workingDirectory: CurrentWorkingDirectory,
    configurationProvider: Provider<CliConfiguration>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class OpenCommand implements Command<OpenInput> {
    private readonly config: OpenConfig;

    public constructor(config: OpenConfig) {
        this.config = config;
    }

    public async execute({url}: OpenInput): Promise<void> {
        if (!URL.canParse(url)) {
            throw new HelpfulError('The URL is not valid.', {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        const parsedUrl = new URL(url);

        if (!this.isValidUrl(parsedUrl)) {
            throw new HelpfulError('The URL is not supported.', {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        const {input, output} = this.config.io;

        if (input === undefined) {
            throw new HelpfulError('Deep links requires explicit user interaction.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    'Retry in interactive mode.',
                ],
            });
        }

        const args = this.parseArguments(parsedUrl);

        output.announce({
            semantics: 'neutral',
            title: '🔗 Croct link',
            message: 'You just opened a link to a `Croct CLI` command.',
            alignment: 'center',
        });

        const command = args.join(' ');

        output.inform(`The command is \`${command}\``);

        if (
            !await input.confirm({
                message: 'Continue?',
                default: true,
            })
        ) {
            return;
        }

        await this.selectDirectory(input);

        await this.config.program(args);
    }

    private async selectDirectory(input: Input): Promise<void> {
        const {workingDirectory, configurationProvider, fileSystem, io: {output}} = this.config;

        const currentDirectory = workingDirectory.get();
        const {projectPaths} = await configurationProvider.get();

        let targetDirectory = '';

        if (projectPaths.length > 0) {
            const parentDirectory = fileSystem.getDirectoryName(projectPaths[0]);

            targetDirectory = await input.select({
                message: 'Where should this command run?',
                options: [
                    {
                        label: `${currentDirectory} (current)`,
                        value: '',
                    },
                    {
                        label: parentDirectory,
                        value: parentDirectory,
                    },
                    ...projectPaths.map(
                        directory => ({
                            value: directory,
                            label: directory,
                        }),
                    ),
                ],
            });
        } else {
            output.inform(`You are currently in \`${currentDirectory}\``);

            if (
                !await input.confirm({
                    message: 'Run the command from the current directory?',
                    default: true,
                })
            ) {
                await input.prompt({
                    message: 'Where do you want to run the command from?',
                    default: currentDirectory,
                    validate: async value => {
                        if (await fileSystem.isDirectory(value)) {
                            return true;
                        }

                        return 'Enter a valid directory path.';
                    },
                });
            }
        }

        if (targetDirectory !== '') {
            workingDirectory.setCurrentDirectory(targetDirectory);
        }
    }

    private parseArguments(url: URL): string[] {
        const args: string[] = [];

        for (const segment of url.pathname.split('/')) {
            if (segment !== '') {
                args.push(segment);
            }
        }

        const rest: string[] = [];

        for (const [key, value] of url.searchParams) {
            if (key === 'arg') {
                rest.push(value);

                continue;
            }

            if (value === '') {
                args.push(`-${key.length === 1 ? '' : '-'}${key}`);

                continue;
            }

            args.push(`--${key}`);
            args.push(value);
        }

        args.push(...rest);

        return args;
    }

    private isValidUrl(url: URL): boolean {
        return url.protocol === `${this.config.protocol}:`
            && url.hostname === ''
            && url.username === ''
            && url.password === ''
            && url.port === ''
            && url.hash === '';
    }
}
