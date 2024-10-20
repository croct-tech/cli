import {Codemod, ResultCode} from '@/application/project/sdk/code/transformation';

export type LayoutComponentOptions = {
    typescript?: boolean,
};

export class CreateLayoutComponent implements Codemod<string, LayoutComponentOptions> {
    public apply(input: string, options: LayoutComponentOptions = {}): ResultCode<string> {
        const isTypescript = options.typescript ?? false;

        const code = [
            ...(isTypescript ? ['import type {ReactNode} from \'react\';'] : []),
            'import {CroctProvider} from \'@croct/plug-next/CroctProvider\';',
            '',
            isTypescript
                ? 'export default function RootLayout({children}: {children: ReactNode}): ReactNode {'
                : 'export default function RootLayout({children}) {',
            '  return (',
            '    <html lang="en">',
            '      <body>',
            '        <CroctProvider>',
            '          {children}',
            '        </CroctProvider>',
            '      </body>',
            '    </html>',
            '  );',
            '}',
        ].join('\n');

        return {
            modified: input !== code,
            result: code,
        };
    }
}
