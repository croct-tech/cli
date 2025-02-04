import {AuthenticationListener, Token} from '@/application/cli/authentication';
import {SynchronousCommandExecutor} from '@/application/process/executor';
import {Command} from '@/application/process/command';

type Callback = () => Promise<void>;

export type Configuration = {
    platform: string,
    listener: AuthenticationListener,
    commandExecutor: SynchronousCommandExecutor,
    timeout?: number,
};

export class FocusListener implements AuthenticationListener {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public wait(sessionId: string): Promise<Token> {
        const {listener} = this.configuration;

        return new Promise((resolve, reject) => {
            this.focus(() => listener.wait(sessionId).then(resolve, reject));
        });
    }

    private focus(callback: Callback): Promise<void> {
        switch (this.configuration.platform) {
            case 'darwin':
                return this.darwinFocus(callback);

            case 'linux':
                return this.linuxFocus(callback);

            case 'win32':
                return this.win32Focus(callback);

            default:
                return callback();
        }
    }

    private async darwinFocus(callback: () => Promise<void>): Promise<void> {
        const name = this.runCommand({
            name: 'osascript',
            arguments: ['-e', 'bundle identifier of (info for (path to frontmost application))'],
        });

        await callback();

        if (name !== null) {
            this.runCommand({
                name: 'open',
                arguments: ['-b', name],
            });
        }
    }

    private async linuxFocus(callback: Callback): Promise<void> {
        const activeWindow = this.runCommand({
            name: 'xdotool',
            arguments: ['getactivewindow'],
        });

        await callback();

        if (activeWindow !== null) {
            this.runCommand({
                name: 'xdotool',
                arguments: ['windowactivate', activeWindow],
            });
        }
    }

    private async win32Focus(callback: Callback): Promise<void> {
        const type = [
            'Add-Type @"',
            'using System;',
            'using System.Runtime.InteropServices;',
            'public class Window {',
            '    [DllImport("user32.dll")]',
            '    public static extern IntPtr GetForegroundWindow();',
            '    [DllImport("user32.dll")]',
            '    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);',
            '    [DllImport("user32.dll")]',
            '    public static extern bool SetForegroundWindow(IntPtr hWnd);',
            '}',
            '"@',
        ];

        const handleCommand = [...type, '[Window]::GetForegroundWindow()'].join('\n');

        const handle = this.runCommand({
            name: 'powershell',
            arguments: ['-Command', `& {${handleCommand}}`],
        });

        await callback();

        if (handle !== null) {
            const focusCommand = [
                ...type,
                `[Window]::SetForegroundWindow(${handle})`,
                `[Window]::ShowWindow(${handle}, 9)`,
            ].join('\n');

            this.runCommand({
                name: 'powershell',
                arguments: ['-Command', `& {${focusCommand}}`],
            });
        }
    }

    private runCommand(command: Command): string|null {
        const {commandExecutor, timeout} = this.configuration;

        try {
            const result = commandExecutor.runSync(command, {
                timeout: timeout,
            });

            if (result.exitCode !== 0) {
                return null;
            }

            return result.output.trim();
        } catch {
            return null;
        }
    }
}
