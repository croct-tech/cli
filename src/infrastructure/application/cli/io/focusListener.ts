import {spawnSync} from 'child_process';
import {AuthenticationListener, Token} from '@/application/cli/authentication';

type Callback = () => Promise<void>;

export class FocusListener implements AuthenticationListener {
    private readonly platform: string;

    private readonly listener: AuthenticationListener;

    public constructor(listener: AuthenticationListener, platform: string) {
        this.platform = platform;
        this.listener = listener;
    }

    public wait(sessionId: string): Promise<Token> {
        return new Promise((resolve, reject) => {
            this.focus(
                () => this.listener
                    .wait(sessionId)
                    .then(resolve, reject),
            );
        });
    }

    private focus(callback: Callback): Promise<void> {
        switch (this.platform) {
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
        const name = this.runCommand(
            'osascript',
            '-e',
            'bundle identifier of (info for (path to frontmost application))',
        );

        await callback();

        if (name !== null) {
            this.runCommand('open', '-b', name);
        }
    }

    private async linuxFocus(callback: Callback): Promise<void> {
        const activeWindow = this.runCommand('xdotool', 'getactivewindow');

        await callback();

        if (activeWindow !== null) {
            this.runCommand('xdotool', 'windowactivate', activeWindow);
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

        const handle = this.runCommand('powershell', '-Command', `& {${handleCommand}}`);

        await callback();

        if (handle !== null) {
            const focusCommand = [
                ...type,
                `[Window]::SetForegroundWindow(${handle})`,
                `[Window]::ShowWindow(${handle}, 9)`,
            ].join('\n');

            this.runCommand('powershell', '-Command', `& {${focusCommand}}`);
        }
    }

    private runCommand(command: string, ...args: string[]): string|null {
        try {
            const result = spawnSync(command, args, {
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            if (result.error !== undefined || result.status !== 0) {
                return null;
            }

            return result.stdout
                .toString()
                .trim();
        } catch {
            return null;
        }
    }
}
