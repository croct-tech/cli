import type {Process} from '@/application/system/process/process';
import {Cli} from '@/infrastructure/application/cli/cli';
import {run} from '@/infrastructure/application/cli/program';

jest.mock('clipboardy', () => ({}));
jest.mock('is-installed-globally', () => false);
jest.mock('is-plain-obj', () => jest.fn());
jest.mock('strip-ansi', () => (value: string): string => value);

jest.mock(
    '@/infrastructure/application/cli/io/browserLinkOpener',
    () => ({
        BrowserLinkOpener: class {},
    }),
);

jest.mock(
    '@/infrastructure/application/cli/io/boxenFormatter',
    () => ({
        BoxenFormatter: class {},
    }),
);

jest.mock(
    '@/infrastructure/application/cli/io/formatting',
    () => ({
        colors: {},
        format: jest.fn(),
    }),
);

jest.mock(
    '@/infrastructure/application/cli/io/interactiveTaskMonitor',
    () => ({
        InteractiveTaskMonitor: class {},
    }),
);

jest.mock(
    '@/infrastructure/application/evaluation/jsepExpressionEvaluator',
    () => ({
        JsepExpressionEvaluator: class {},
    }),
);

describe('CLI program', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        {event: 'preinstall', expected: false},
        {event: 'prepare', expected: false},
        {event: 'postinstall', expected: false},
        {event: 'postbuild', expected: false},
        {event: null, expected: undefined},
        {event: '', expected: undefined},
        {event: 'install', expected: undefined},
        {event: 'build', expected: undefined},
    ])('should configure interaction for lifecycle event $event', async ({event, expected}) => {
        const factory = jest.spyOn(Cli, 'fromDefaults').mockReturnValue({logout: jest.fn()} as unknown as Cli);
        const runtime = {
            getEnvValue: (): string | null => event,
        } as Partial<Process> as Process;

        await run(['node', 'croct', 'logout'], false, runtime);

        expect(factory).toHaveBeenCalledWith(expect.objectContaining({
            process: runtime,
            interactive: expected,
        }));
    });

    it('should preserve the explicit non-interactive override', async () => {
        const factory = jest.spyOn(Cli, 'fromDefaults').mockReturnValue({logout: jest.fn()} as unknown as Cli);
        const runtime = {
            getEnvValue: (): null => null,
        } as Partial<Process> as Process;

        await run(['node', 'croct', '--no-interaction', 'logout'], false, runtime);

        expect(factory).toHaveBeenCalledWith(expect.objectContaining({
            process: runtime,
            interactive: false,
        }));
    });

    it('should resolve the default directory from the injected process', () => {
        const getCurrentDirectory = jest.fn(() => '/sentinel/project');
        const runtime = {
            getCurrentDirectory: getCurrentDirectory,
        } as Partial<Process> as Process;

        Cli.fromDefaults({process: runtime});

        expect(getCurrentDirectory).toHaveBeenCalledTimes(1);
    });
});
